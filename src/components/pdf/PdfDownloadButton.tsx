'use client'

import * as React from 'react'
import { pdf } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/lib/store/project'
import { useMaterialsStore } from '@/lib/store/materials'
import { CutListPDF } from './CutListPDF'

export function PdfDownloadButton() {
  const project = useProjectStore((s) => s.project)
  const materials = useMaterialsStore((s) => s.materials)
  const [busy, setBusy] = React.useState(false)

  const handleDownload = async () => {
    setBusy(true)
    try {
      const blob = await pdf(
        <CutListPDF project={project} materials={materials} />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name.replace(/[^a-z0-9-_]+/gi, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button onClick={handleDownload} variant="outline" disabled={busy}>
      {busy ? 'Generating…' : 'Download PDF'}
    </Button>
  )
}
