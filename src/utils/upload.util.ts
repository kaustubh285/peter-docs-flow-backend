import { Context } from 'hono'

export interface UploadedFile {
  originalname: string
  buffer: Buffer
  mimetype: string
  size: number
}

export async function parseMultipartForm(c: Context): Promise<{
  file?: UploadedFile
  fields: Record<string, string>
}> {
  const body = await c.req.parseBody()
  const fields: Record<string, string> = {}
  let file: UploadedFile | undefined

  for (const [key, value] of Object.entries(body)) {
    if (value instanceof File) {
      const buffer = Buffer.from(await value.arrayBuffer())
      file = {
        originalname: value.name,
        buffer,
        mimetype: value.type,
        size: value.size
      }
    } else if (typeof value === 'string') {
      fields[key] = value
    }
  }

  return { file, fields }
}
