import type { Brand, Content, Design, ExtractedMenu, Locale } from '../schemas'

export type ImageMime = 'image/webp' | 'image/jpeg' | 'image/png'
export type MenuFile = { bytes: Uint8Array; mime: ImageMime | 'application/pdf' }
export type PhotoRef = { id: string; bytes: Uint8Array; mime: ImageMime; width: number; height: number }

export type ExtractContext = { name: string; description: string }
export type BrandContext = { name: string; description: string; menu: ExtractedMenu; hasLogo: boolean; websiteLang: Locale; photoCount: number }
export type DesignContext = { name: string; brand: Brand; menu: ExtractedMenu; photos: PhotoRef[]; hasAbout: boolean; websiteLang: Locale }
export type ContentContext = { name: string; description: string; menu: ExtractedMenu; brand: Brand; websiteLang: Locale; address: string; phone: string }

export interface AiProvider {
  readonly name: string
  extractMenu(files: MenuFile[], ctx: ExtractContext): Promise<ExtractedMenu>
  brand(ctx: BrandContext): Promise<Brand>
  design(ctx: DesignContext): Promise<Design>
  content(ctx: ContentContext): Promise<Content>
  /** Is this crop a clean, usable logo? */
  judgeLogo(image: { bytes: Uint8Array; mime: ImageMime }): Promise<boolean>
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message)
  }
}
