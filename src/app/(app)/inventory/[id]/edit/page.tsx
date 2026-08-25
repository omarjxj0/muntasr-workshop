import EcuForm from '../../EcuForm'

interface Props { params: Promise<{ id: string }> }

export default async function EditInventoryPage({ params }: Props) {
  const { id } = await params
  return <EcuForm mode="edit" ecuId={id} />
}
