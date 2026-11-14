import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import { conferirSenha, gerarHash, hashToken, novoToken, Perfil, SENHA_MINIMA, senhaTemporaria, SESSAO_HORAS, Tentativas } from './auth-util';

export interface Usuario {
  id: number;
  login: string;
  nome: string;
  perfil: Perfil;
  trocarSenha: boolean;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id serial PRIMARY KEY,
  login text UNIQUE NOT NULL,
  nome text NOT NULL,
  senha_hash text NOT NULL,
  perfil text NOT NULL CHECK (perfil IN ('leitura', 'escrita', 'admin')),
  ativo boolean NOT NULL DEFAULT true,
  trocar_senha boolean NOT NULL DEFAULT true,
  ultimo_login timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessoes (
  token_hash text PRIMARY KEY,
  usuario_id int NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em timestamptz NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);`;

const CAMPOS = `u.id, u.login, u.nome, u.perfil, u.trocar_senha AS "trocarSenha"`;

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  // Lê o env direto para o comando criar-usuario usar o mesmo serviço sem subir o Nest.
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  private readonly tentativas = new Tentativas();
  private pronto?: Promise<void>;
  private hashFalso?: Promise<string>;

  /** Cria as tabelas na primeira chamada; se o banco estiver fora, tenta de novo na próxima. */
  private db() {
    return (this.pronto ??= this.pool.query(SCHEMA).then(
      () => undefined,
      (e) => {
        this.pronto = undefined;
        throw e;
      },
    ));
  }

  async login(loginBruto: string, senha: string): Promise<{ token: string; usuario: Usuario }> {
    const login = loginBruto.trim().toLowerCase();
    if (this.tentativas.bloqueado(login)) {
      throw new HttpException('Muitas tentativas erradas. Aguarde 15 minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.db();
    const { rows } = await this.pool.query(`SELECT ${CAMPOS}, u.senha_hash FROM usuarios u WHERE u.login = $1 AND u.ativo`, [login]);
    const u = rows[0];
    // Sem usuário, confere contra um hash qualquer: a resposta leva o mesmo tempo e não revela quem existe.
    const ok = await conferirSenha(senha, u?.senha_hash ?? (await (this.hashFalso ??= gerarHash('nao-existe'))));
    if (!u || !ok) {
      this.tentativas.falhou(login);
      this.logger.warn(`Login recusado: ${login}`);
      throw new UnauthorizedException('Usuário ou senha inválidos');
    }
    this.tentativas.limpar(login);
    const token = novoToken();
    await this.pool.query(`DELETE FROM sessoes WHERE expira_em < now()`);
    await this.pool.query(
      `INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES ($1, $2, now() + make_interval(hours => $3))`,
      [hashToken(token), u.id, SESSAO_HORAS],
    );
    await this.pool.query(`UPDATE usuarios SET ultimo_login = now() WHERE id = $1`, [u.id]);
    this.logger.log(`Login: ${login}`);
    delete u.senha_hash;
    return { token, usuario: u };
  }

  async validar(token?: string): Promise<Usuario | null> {
    if (!token) return null;
    await this.db();
    const { rows } = await this.pool.query(
      `SELECT ${CAMPOS} FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = $1 AND s.expira_em > now() AND u.ativo`,
      [hashToken(token)],
    );
    return rows[0] ?? null;
  }

  async logout(token?: string) {
    if (!token) return;
    await this.db();
    await this.pool.query(`DELETE FROM sessoes WHERE token_hash = $1`, [hashToken(token)]);
  }

  /** Troca a própria senha; derruba as outras sessões do usuário e mantém a atual. */
  async trocarSenha(usuario: Usuario, tokenAtual: string, atual: string, nova: string) {
    if (nova.length < SENHA_MINIMA) throw new BadRequestException(`A senha nova precisa de ${SENHA_MINIMA} caracteres ou mais`);
    if (nova === atual) throw new BadRequestException('A senha nova precisa ser diferente da atual');
    const { rows } = await this.pool.query(`SELECT senha_hash FROM usuarios WHERE id = $1`, [usuario.id]);
    if (!rows[0] || !(await conferirSenha(atual, rows[0].senha_hash))) throw new BadRequestException('Senha atual incorreta');
    await this.pool.query(`UPDATE usuarios SET senha_hash = $2, trocar_senha = false WHERE id = $1`, [usuario.id, await gerarHash(nova)]);
    await this.pool.query(`DELETE FROM sessoes WHERE usuario_id = $1 AND token_hash <> $2`, [usuario.id, hashToken(tokenAtual)]);
    this.logger.log(`Senha trocada: ${usuario.login}`);
  }

  // --- gestão da equipe (só admin) ---

  async listar() {
    await this.db();
    const { rows } = await this.pool.query(
      `SELECT ${CAMPOS}, u.ativo, u.ultimo_login AS "ultimoLogin", u.criado_em AS "criadoEm" FROM usuarios u ORDER BY u.nome`,
    );
    return rows;
  }

  /** Cria (ou recria) o usuário com uma senha temporária, que a pessoa troca no primeiro acesso. */
  async criar(loginBruto: string, nome: string, perfil: Perfil, senha = senhaTemporaria()) {
    const login = loginBruto.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(login)) throw new BadRequestException('Login: 3 a 32 letras minúsculas, números, ponto, hífen ou _');
    await this.db();
    const { rows } = await this.pool.query(
      `INSERT INTO usuarios (login, nome, perfil, senha_hash) VALUES ($1, $2, $3, $4)
       ON CONFLICT (login) DO NOTHING RETURNING id`,
      [login, nome.trim(), perfil, await gerarHash(senha)],
    );
    if (!rows[0]) throw new BadRequestException(`O login ${login} já existe`);
    this.logger.log(`Usuário criado: ${login} (${perfil})`);
    return { id: rows[0].id as number, login, senhaTemporaria: senha };
  }

  async alterar(alvoId: number, quem: Usuario, mudanca: { perfil?: Perfil; ativo?: boolean }) {
    if (alvoId === quem.id) throw new BadRequestException('Você não pode mudar o próprio perfil nem se desativar');
    const { rowCount } = await this.pool.query(
      `UPDATE usuarios SET perfil = COALESCE($2, perfil), ativo = COALESCE($3, ativo) WHERE id = $1`,
      [alvoId, mudanca.perfil ?? null, mudanca.ativo ?? null],
    );
    if (!rowCount) throw new NotFoundException('Usuário não encontrado');
    await this.pool.query(`DELETE FROM sessoes WHERE usuario_id = $1`, [alvoId]); // vale na hora
    this.logger.log(`Usuário ${alvoId} alterado por ${quem.login}: ${JSON.stringify(mudanca)}`);
  }

  async novaSenhaTemporaria(alvoId: number, quem: Usuario) {
    if (alvoId === quem.id) throw new BadRequestException('Para a sua senha, use "Trocar senha"');
    const senha = senhaTemporaria();
    const { rowCount } = await this.pool.query(`UPDATE usuarios SET senha_hash = $2, trocar_senha = true WHERE id = $1`, [alvoId, await gerarHash(senha)]);
    if (!rowCount) throw new NotFoundException('Usuário não encontrado');
    await this.pool.query(`DELETE FROM sessoes WHERE usuario_id = $1`, [alvoId]);
    this.logger.log(`Senha temporária gerada para ${alvoId} por ${quem.login}`);
    return { senhaTemporaria: senha };
  }

  /** Só para o comando criar-usuario: o primeiro admin escolhe a própria senha. */
  async criarComSenha(login: string, nome: string, perfil: Perfil, senha: string) {
    if (senha.length < SENHA_MINIMA) throw new BadRequestException(`A senha precisa de ${SENHA_MINIMA} caracteres ou mais`);
    const r = await this.criar(login, nome, perfil, senha);
    await this.pool.query(`UPDATE usuarios SET trocar_senha = false WHERE id = $1`, [r.id]);
    return r.login;
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
