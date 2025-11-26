declare module 'pdfmake/build/pdfmake' {
    const pdfMake: any;
    export = pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
    const vfs: any;
    export = vfs;
}

// Compatibility for dynamic import default
declare module 'pdfmake' {
    const pdfMake: any;
    export default pdfMake;
}
