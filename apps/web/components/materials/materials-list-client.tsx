'use client'

import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConsolidatedMaterialsTable } from './consolidated-materials-table'
import { MaterialsBySupplierView } from './materials-by-supplier'
import type { ConsolidatedMaterial, MaterialsBySupplier } from '@/lib/types/materials'

interface MaterialsListClientProps {
  materials: ConsolidatedMaterial[]
  suppliers: MaterialsBySupplier[]
  budgetVersionId: string
  projectName: string
  versionCode: string
}

export function MaterialsListClient({
  materials,
  suppliers,
  budgetVersionId,
  projectName,
  versionCode,
}: MaterialsListClientProps) {
  const t = useTranslations('materials')

  return (
    <Tabs defaultValue="consolidated" className="space-y-6">
      <TabsList>
        <TabsTrigger value="consolidated">{t('tabConsolidated')}</TabsTrigger>
        <TabsTrigger value="by-supplier">{t('tabBySupplier')}</TabsTrigger>
      </TabsList>
      <TabsContent value="consolidated">
        <ConsolidatedMaterialsTable materials={materials} budgetVersionId={budgetVersionId} />
      </TabsContent>
      <TabsContent value="by-supplier">
        <MaterialsBySupplierView suppliers={suppliers} budgetVersionId={budgetVersionId} />
      </TabsContent>
    </Tabs>
  )
}
