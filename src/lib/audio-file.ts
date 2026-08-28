import 'server-only';

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';

/**
 * Encontra sozinho a trilha em `public/audio/`.
 *
 * Antes, a música só tocava depois de alguém abrir o painel e digitar o
 * endereço do arquivo. Isso é um passo a mais para uma coisa que o servidor
 * consegue descobrir: se existe exatamente um arquivo de áudio na pasta, é
 * evidentemente ele que deve tocar.
 *
 * A configuração do painel continua tendo prioridade. Esta função só entra em
 * cena quando o campo está vazio — que é o estado de quem acabou de largar o
 * MP3 na pasta e não fez mais nada.
 */

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.ogg', '.oga', '.opus', '.wav', '.aac', '.flac'];

export const findLocalTrack = cache(async (): Promise<string | null> => {
  try {
    const dir = path.join(process.cwd(), 'public', 'audio');
    const entries = await readdir(dir, { withFileTypes: true });

    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => AUDIO_EXTENSIONS.includes(path.extname(name).toLowerCase()))
      // Nome mais curto primeiro. Arquivo baixado do YouTube costuma vir com
      // um nome enorme cheio de parênteses; se a pessoa também tiver deixado
      // uma cópia com nome limpo, é a limpa que queremos.
      .sort((a, b) => a.length - b.length || a.localeCompare(b, 'pt-BR'));

    const chosen = files[0];
    if (!chosen) return null;

    /**
     * `encodeURIComponent` é obrigatório, não zelo.
     *
     * Arquivos salvos do navegador chegam com espaços, parênteses e apóstrofos
     * no nome — "Feet Don't Fail Me Now (Official Video).mp3" é um caso real
     * daqui. Sem codificar, o apóstrofo e os espaços quebram o atributo `src`
     * e o áudio nunca carrega. Codificado, qualquer nome funciona e ninguém
     * precisa renomear nada.
     */
    return `/audio/${encodeURIComponent(chosen)}`;
  } catch {
    // A pasta pode simplesmente não existir. Não é erro: é ausência de trilha.
    return null;
  }
});
