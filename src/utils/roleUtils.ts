export const displayRole = (role?: string | null) => {
    if (!role) return ''
    switch (role) {
        case 'captain':
            return 'Capitão'
        case 'volunteer':
            return 'Voluntário'
        case 'admin':
            return 'Administrador'
        default:
            // fallback: capitalize
            return role.charAt(0).toUpperCase() + role.slice(1)
    }
}

export const getRoleEmoji = (role?: string | null) => {
    if (!role) return ''
    switch (role) {
        case 'captain':
            return '🧑‍✈️'
        case 'volunteer':
            return '🤝'
        case 'admin':
            return '🛠️'
        default:
            return ''
    }
}

export default displayRole
