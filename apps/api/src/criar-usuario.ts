/**
 * Cria o primeiro admin (os demais usuários o admin cria pelo painel, em Usuários).
 * Uso, dentro do container da API:
 *   node apps/api/dist/apps/api/src/criar-usuario.js <login> <leitura|escrita|admin> [Nome completo]
 * A senha é pedida sem aparecer na tela.
 */
import { createInterface } from 'node:readline';
import { AuthService } from './modules/auth/auth.service';
import { Perfil, PERFIS, SENHA_MINIMA } from './modules/auth/auth-util';

function perguntarSemEco(pergunta: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((ok) => {
    rl.question(pergunta, (resposta) => {
      rl.close();
      process.stdout.write('\n');
      ok(resposta);
    });
    // Depois de mostrar a pergunta, para de ecoar o que é digitado.
    (rl as unknown as { _writeToOutput: () => void })._writeToOutput = () => undefined;
  });
}

async function main() {
  const [login, perfil, ...nome] = process.argv.slice(2);
  if (!login || !PERFIS.includes(perfil as Perfil)) {
    console.error(`Uso: criar-usuario <login> <${PERFIS.join('|')}> [Nome completo]`);
    process.exit(1);
  }
  const senha = await perguntarSemEco(`Senha para ${login} (${SENHA_MINIMA}+ caracteres): `);
  if ((await perguntarSemEco('Repita a senha: ')) !== senha) throw new Error('As senhas não conferem');

  const auth = new AuthService();
  try {
    const salvo = await auth.criarComSenha(login, nome.join(' ') || login, perfil as Perfil, senha);
    console.log(`Usuário ${salvo} (${perfil}) criado.`);
  } finally {
    await auth.onModuleDestroy();
  }
}

main().catch((e) => {
  console.error(`Erro: ${e.message}`);
  process.exit(1);
});
