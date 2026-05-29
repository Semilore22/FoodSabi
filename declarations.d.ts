declare module "*.module.css" {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module "browser-image-compression" {
  interface Options {
    maxSizeMB?: number
    maxWidthOrHeight?: number
    useWebWorker?: boolean
  }
  export default function imageCompression(file: File, options: Options): Promise<File>
}
