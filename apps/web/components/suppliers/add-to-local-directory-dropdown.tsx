'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, ChevronDown } from 'lucide-react'

type AddToLocalDirectoryDropdownProps = {
  canAddLocal: boolean
}

export function AddToLocalDirectoryDropdown({ canAddLocal }: AddToLocalDirectoryDropdownProps) {
  const t = useTranslations('suppliers')

  if (!canAddLocal) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default">
          <Plus className="mr-2 h-4 w-4" />
          {t('addToLocalDirectory', { defaultValue: 'Agregar a directorio local' })}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuItem asChild>
          <Link href="/suppliers/local/new" className="cursor-pointer">
            {t('typeSuppliers')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/suppliers/clients/new" className="cursor-pointer">
            {t('typeClients')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
