'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ConsolidatedMaterialsTable } from './consolidated-materials-table'
import { MaterialsBySupplierView } from './materials-by-supplier'
import { CreatePurchaseOrderDialog } from './create-purchase-order-dialog'
import { ShoppingCart } from 'lucide-react'
import type { ConsolidatedMaterial, MaterialsBySupplier } from '@/lib/types/materials'

interface MaterialsListClientProps {
  materials: ConsolidatedMaterial[]
  suppliers: MaterialsBySupplier[]
  budgetVersionId: string
  projectId: string
  projectName: string
  versionCode: string
}

export function MaterialsListClient({
  materials,
  suppliers,
  budgetVersionId,
  projectId,
  projectName,
  versionCode,
}: MaterialsListClientProps) {
  const t = useTranslations('materials')
  const [showPODialog, setShowPODialog] = useState(false)

  return (
    <div className="space-y-6">
      <Tabs defaultValue="consolidated">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="consolidated">{t('tabConsolidated')}</TabsTrigger>
            <TabsTrigger value="by-supplier">{t('tabBySupplier')}</TabsTrigger>
          </TabsList>
          <Button onClick={() => setShowPODialog(true)} variant="default">
            <ShoppingCart className="mr-2 h-4 w-4" />
            {t('emitPurchaseOrder', { defaultValue: 'Emitir orden de compra' })}
          </Button>
        </div>
        <TabsContent value="consolidated" className="mt-4">
          <ConsolidatedMaterialsTable materials={materials} budgetVersionId={budgetVersionId} />
        </TabsContent>
        <TabsContent value="by-supplier" className="mt-4">
          <MaterialsBySupplierView suppliers={suppliers} budgetVersionId={budgetVersionId} />
        </TabsContent>
      </Tabs>

      <CreatePurchaseOrderDialog
        open={showPODialog}
        onOpenChange={setShowPODialog}
        projectId={projectId}
        budgetVersionId={budgetVersionId}
      />
    </div>
  )
}
