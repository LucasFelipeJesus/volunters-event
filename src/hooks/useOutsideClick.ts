import { useEffect } from 'react'

// Hook para detectar clique fora de elementos e tecla Escape
// refs: array de refs a considerar como "dentro"
// handler: função chamada quando detecta clique fora ou Escape
// active (opcional): quando false, o hook não adiciona listeners
export default function useOutsideClick(
    refs: Array<React.RefObject<HTMLElement | null>>,
    handler: (e?: Event) => void,
    active = true
) {
    useEffect(() => {
        if (!active) return

        const onDocClick = (e: MouseEvent) => {
            const target = e.target as Node
            const inside = refs.some(r => r.current && r.current.contains(target))
            if (!inside) handler(e)
        }

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handler(e)
        }

        document.addEventListener('mousedown', onDocClick)
        document.addEventListener('touchstart', onDocClick)
        document.addEventListener('keydown', onKey)

        return () => {
            document.removeEventListener('mousedown', onDocClick)
            document.removeEventListener('touchstart', onDocClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [refs, handler, active])
}
