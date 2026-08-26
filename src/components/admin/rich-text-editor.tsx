'use client';

/**
 * Editor de texto rico do CMS — item 18 do escopo.
 *
 * `contenteditable` + `document.execCommand`. O comando é oficialmente
 * obsoleto, mas continua sendo a forma que funciona em todos os navegadores
 * sem trazer uma biblioteca de 200 kB para o bundle. Se a VFA quiser algo mais
 * completo depois, é só trocar este componente: o resto do sistema só conhece
 * a string de HTML que ele produz.
 *
 * O HTML é sanitizado NO SERVIDOR antes de gravar (src/lib/sanitize.ts). Nada
 * do que for digitado aqui é confiado.
 */

import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Command = {
  label: string;
  icon: ReactNode;
  run: (exec: (command: string, value?: string) => void) => void;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escreva a matéria…',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // Só sincroniza de fora para dentro quando o conteúdo realmente diverge —
  // reescrever o innerHTML a cada tecla faria o cursor pular para o começo.
  useEffect(() => {
    const node = ref.current;
    if (node && node.innerHTML !== value) {
      node.innerHTML = value;
    }
  }, [value]);

  const exec = (command: string, argument?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, argument);
    onChange(ref.current?.innerHTML ?? '');
  };

  const commands: Command[] = [
    { label: 'Negrito', icon: <Bold className="size-4" />, run: (e) => e('bold') },
    { label: 'Itálico', icon: <Italic className="size-4" />, run: (e) => e('italic') },
    {
      label: 'Título',
      icon: <Heading2 className="size-4" />,
      run: (e) => e('formatBlock', '<h2>'),
    },
    {
      label: 'Subtítulo',
      icon: <Heading3 className="size-4" />,
      run: (e) => e('formatBlock', '<h3>'),
    },
    {
      label: 'Citação',
      icon: <Quote className="size-4" />,
      run: (e) => e('formatBlock', '<blockquote>'),
    },
    { label: 'Lista', icon: <List className="size-4" />, run: (e) => e('insertUnorderedList') },
    {
      label: 'Lista numerada',
      icon: <ListOrdered className="size-4" />,
      run: (e) => e('insertOrderedList'),
    },
    {
      label: 'Link',
      icon: <Link2 className="size-4" />,
      run: (e) => {
        const url = window.prompt('Endereço do link (https://…)');
        if (url) e('createLink', url);
      },
    },
    {
      label: 'Imagem',
      icon: <ImageIcon className="size-4" />,
      run: (e) => {
        const url = window.prompt('URL da imagem (https://…)');
        if (url) e('insertImage', url);
      },
    },
    { label: 'Desfazer', icon: <Undo2 className="size-4" />, run: (e) => e('undo') },
    { label: 'Refazer', icon: <Redo2 className="size-4" />, run: (e) => e('redo') },
  ];

  const isEmpty = !value || value === '<br>' || value === '<p></p>';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border transition-colors',
        focused ? 'border-accent/60' : 'border-line-strong',
      )}
    >
      <div className="flex flex-wrap gap-0.5 border-b border-line bg-surface-2 p-1.5">
        {commands.map((command) => (
          <button
            key={command.label}
            type="button"
            title={command.label}
            aria-label={command.label}
            onMouseDown={(event) => {
              // Impede a perda da seleção antes de aplicar o comando.
              event.preventDefault();
              command.run(exec);
            }}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-3 hover:text-fg"
          >
            {command.icon}
          </button>
        ))}
      </div>

      <div className="relative">
        {isEmpty && !focused ? (
          <span className="pointer-events-none absolute top-4 left-4 text-sm text-subtle">
            {placeholder}
          </span>
        ) : null}

        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Conteúdo da notícia"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onInput={(event) => onChange((event.target as HTMLDivElement).innerHTML)}
          onPaste={(event) => {
            // Cola como texto simples: evita trazer estilos e markup do Word,
            // do Discord ou de outro site direto para dentro da matéria.
            event.preventDefault();
            const text = event.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
            onChange(ref.current?.innerHTML ?? '');
          }}
          className="prose-vfa min-h-56 bg-surface-2 px-4 py-3 text-sm focus:outline-none"
        />
      </div>

      <p className="border-t border-line bg-surface-2 px-4 py-2 text-[0.7rem] text-subtle">
        O conteúdo é limpo no servidor antes de ser salvo: scripts e atributos perigosos são
        removidos automaticamente.
      </p>
    </div>
  );
}
