import { useParams } from "react-router"

export default function TripDetailPage() {
  const { tripId } = useParams()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Trip {tripId}</h1>
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Trip details — Phase E
      </div>
    </div>
  )
}
