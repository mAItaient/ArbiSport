/**
 * Deux boutons de lien vers les bookmakers.
 * - Cliquable (target=_blank) si l'URL est disponible
 * - Grisé et non cliquable si l'URL est null/undefined
 */
interface BookmakerLinkButtonsProps {
  bookmakerA: string
  bookmakerB: string
  urlA?: string | null
  urlB?: string | null
}

export default function BookmakerLinkButtons({
  bookmakerA,
  bookmakerB,
  urlA,
  urlB,
}: BookmakerLinkButtonsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <BookmakerButton name={bookmakerA} url={urlA} />
      <BookmakerButton name={bookmakerB} url={urlB} />
    </div>
  )
}

function BookmakerButton({ name, url }: { name: string; url?: string | null }) {
  const hasUrl = !!url

  if (hasUrl) {
    return (
      <a
        href={url!}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        <span>🔗</span>
        <span>{name}</span>
      </a>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-400 text-sm rounded-lg cursor-not-allowed select-none">
      <span>🔗</span>
      <span>{name}</span>
    </span>
  )
}
