import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirFreio, FREIO, ipReal, semSegredos } from '../src/modules/auth/auditoria-util.ts';

test('freio: deixa passar abaixo dos limites', () => {
  assert.equal(decidirFreio({ global: 0, usuario: 0, roteadorHora: 0 }), null);
  assert.equal(decidirFreio({ global: FREIO.globalMax - 1, usuario: FREIO.usuarioMax - 1, roteadorHora: FREIO.roteadorHoraMax - 1 }), null);
});

test('freio: barra no limite de cada regra', () => {
  assert.match(decidirFreio({ global: 0, usuario: 0, roteadorHora: FREIO.roteadorHoraMax }), /este roteador/);
  assert.match(decidirFreio({ global: 0, usuario: FREIO.usuarioMax, roteadorHora: 0 }), /você fez/);
  assert.match(decidirFreio({ global: FREIO.globalMax, usuario: 0, roteadorHora: 0 }), /a equipe fez/);
});

test('registro: nunca guarda senha, nem aninhada', () => {
  const r = semSegredos({ band: '2.4GHz', password: 'segredo', ssid: 'Casa', dados: { senhaTemporaria: 'x', perfil: 'leitura' }, vazio: '' });
  assert.deepEqual(r, { band: '2.4GHz', password: '***', ssid: 'Casa', dados: { senhaTemporaria: '***', perfil: 'leitura' }, vazio: '' });
  assert.equal(semSegredos(null), null);
});

test('ip: vale o último do X-Forwarded-For (o que o Traefik acrescentou)', () => {
  assert.equal(ipReal('1.1.1.1, 200.10.20.30'), '200.10.20.30');
  assert.equal(ipReal(undefined, '10.0.0.5'), '10.0.0.5');
  assert.equal(ipReal(['9.9.9.9', '8.8.8.8']), '8.8.8.8');
  assert.equal(ipReal(''), null);
});
