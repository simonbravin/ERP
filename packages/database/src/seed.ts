import bcrypt from 'bcryptjs'
import { prisma } from './client'

async function seedCurrencies() {
  await prisma.currency.createMany({
    data: [
      { code: 'ARS', name: 'Peso Argentino', symbol: '$', decimalPlaces: 2, active: true },
      { code: 'USD', name: 'Dólar Estadounidense', symbol: 'US$', decimalPlaces: 2, active: true },
      { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2, active: true },
      { code: 'BRL', name: 'Real Brasileño', symbol: 'R$', decimalPlaces: 2, active: true },
      { code: 'CLP', name: 'Peso Chileno', symbol: '$', decimalPlaces: 2, active: true },
      { code: 'COP', name: 'Peso Colombiano', symbol: '$', decimalPlaces: 2, active: true },
      { code: 'MXN', name: 'Peso Mexicano', symbol: '$', decimalPlaces: 2, active: true },
    ],
    skipDuplicates: true,
  })
}

/** Dev user: username Simon, password Livestrong=15; creates org "Dev Org" and adds user as OWNER */
async function seedDevUser() {
  const email = 'simon@dev.local'
  const username = 'Simon'
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  })
  if (existingUser) {
    const member = await prisma.orgMember.findFirst({
      where: { userId: existingUser.id, active: true },
    })
    if (member) return
    const org = await prisma.organization.findFirst({ where: { slug: 'dev-org' } })
    if (org) {
      await prisma.orgMember.create({
        data: { orgId: org.id, userId: existingUser.id, role: 'OWNER', active: true },
      })
      console.log('Seed: Simon added to Dev Org')
    }
    return
  }
  const passwordHash = await bcrypt.hash('Livestrong=15', 10)
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        username,
        fullName: 'Simon (dev)',
        passwordHash,
        active: true,
      },
    })
    const org = await tx.organization.create({
      data: { name: 'Dev Org', slug: 'dev-org', active: true },
    })
    await tx.orgProfile.create({
      data: { orgId: org.id, legalName: 'Dev Org', baseCurrency: 'ARS', defaultTaxPct: 21 },
    })
    await tx.orgMember.create({
      data: { orgId: org.id, userId: user.id, role: 'OWNER', active: true },
    })
  })
  console.log('Seed: dev user Simon created (email: simon@dev.local, password: Livestrong=15)')
}

/** Creates a demo project and sample daily reports for development (Libro de Obra) */
async function seedDailyReports() {
  const org = await prisma.organization.findFirst({ where: { active: true } })
  if (!org) return
  const member = await prisma.orgMember.findFirst({
    where: { orgId: org.id, active: true },
    select: { id: true },
  })
  if (!member) return
  let project = await prisma.project.findFirst({
    where: { orgId: org.id },
    select: { id: true },
  })
  if (!project) {
    const created = await prisma.project.create({
      data: {
        orgId: org.id,
        projectNumber: 'DEMO-001',
        name: 'Proyecto Demo',
        createdByOrgMemberId: member.id,
        phase: 'CONSTRUCTION',
        status: 'ACTIVE',
      },
    })
    project = { id: created.id }
    console.log('Seed: demo project created for daily reports')
  }
  const existing = await prisma.dailyReport.count({ where: { projectId: project.id } })
  if (existing > 0) return
  const today = new Date()
  const reports = [
    {
      reportDate: new Date(today),
      summary: 'Avance en cimentación y replanteo. Cuadrilla de 8 personas.',
      status: 'DRAFT' as const,
      workAccomplished: 'Trabajos de excavación y hormigonado de zapata. Replanteo de ejes.',
      weather: 'SUNNY' as const,
      observations: null as string | null,
    },
    {
      reportDate: new Date(today.getTime() - 86400000),
      summary: 'Colocación de armaduras y preparación para losa.',
      status: 'SUBMITTED' as const,
      workAccomplished: 'Armado de vigas y columnas. Inspección de armaduras.',
      weather: 'CLOUDY' as const,
      observations: 'Retraso por lluvia en la mañana.',
    },
    {
      reportDate: new Date(today.getTime() - 2 * 86400000),
      summary: 'Hormigonado de losa de planta baja. Sin incidencias.',
      status: 'APPROVED' as const,
      workAccomplished: 'Hormigonado completo. Curado iniciado.',
      weather: 'SUNNY' as const,
      observations: null as string | null,
    },
  ]
  for (const r of reports) {
    const created = await prisma.dailyReport.create({
      data: {
        orgId: org.id,
        projectId: project.id,
        reportDate: r.reportDate,
        summary: r.summary,
        workAccomplished: r.workAccomplished,
        observations: r.observations,
        weather: r.weather,
        status: r.status,
        createdByOrgMemberId: member.id,
        ...(r.status === 'SUBMITTED' && { submittedAt: new Date() }),
        ...(r.status === 'APPROVED' && {
          submittedAt: new Date(),
          approvedByOrgMemberId: member.id,
          approvedAt: new Date(),
        }),
      },
    })
    await prisma.dailyReportLabor.createMany({
      data: [
        { orgId: org.id, dailyReportId: created.id, trade: 'Albañil', workerCount: 4, hoursWorked: 8 },
        { orgId: org.id, dailyReportId: created.id, trade: 'Oficial', workerCount: 2, hoursWorked: 8 },
      ],
    })
  }
  console.log('Seed: 3 daily reports (Libro de Obra) created')
}

async function main() {
  await seedCurrencies()
  await seedDevUser()
  await seedDailyReports()
  console.log('Seed completed: currencies, dev user, daily reports')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
