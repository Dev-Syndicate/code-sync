import { Loader } from '@/components/ui/Loader'

export default function SessionLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <Loader text="Loading session..." size="lg" />
    </div>
  )
}
