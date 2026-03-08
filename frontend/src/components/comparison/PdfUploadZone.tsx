import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PdfUploadZoneProps {
  onUpload: (file: File) => void
  isUploading: boolean
}

export default function PdfUploadZone({ onUpload, isUploading }: PdfUploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) onUpload(acceptedFiles[0])
    },
    [onUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      // Some systems send CSV with this MIME type
      'application/csv': ['.csv'],
    },
    multiple: false,
    disabled: isUploading,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/50 hover:bg-accent/30',
        isUploading && 'pointer-events-none opacity-60'
      )}
    >
      <input {...getInputProps()} />

      {isUploading ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Parsing file…</p>
        </>
      ) : (
        <>
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              {isDragActive ? 'Drop the file here' : 'Drag & drop a proposed price list'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              or click to browse · PDF, Excel (.xlsx), or CSV · max 20 MB
            </p>
          </div>
        </>
      )}
    </div>
  )
}
