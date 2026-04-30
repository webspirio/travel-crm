import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { Search } from "lucide-react"

import { HotelCard } from "@/components/hotel/hotel-card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBookings } from "@/hooks/queries/use-bookings"
import { useHotels } from "@/hooks/queries/use-hotels"
import { useTrips } from "@/hooks/queries/use-trips"
import { getHotelStats } from "@/lib/stats"

type SortKey = "nameAsc" | "starsDesc" | "occupancyDesc"

export default function HotelsListPage() {
  const { t } = useTranslation("hotels")
  const [query, setQuery] = useState("")
  const [stars, setStars] = useState<string>("all")
  const [country, setCountry] = useState<string>("all")
  const [sortKey, setSortKey] = useState<SortKey>("occupancyDesc")

  const { data: hotels = [] } = useHotels()
  const { data: trips = [] } = useTrips()
  const { data: bookings = [] } = useBookings()

  const countries = useMemo(
    () => [...new Set(hotels.map((h) => h.country))].sort(),
    [hotels],
  )

  const enriched = useMemo(
    () =>
      hotels.map((h) => ({
        hotel: h,
        stats: getHotelStats(h.id, trips, bookings, hotels),
      })),
    [hotels, trips, bookings],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = enriched.filter(({ hotel }) => {
      if (q && !hotel.name.toLowerCase().includes(q) && !hotel.city.toLowerCase().includes(q))
        return false
      if (stars !== "all" && String(hotel.stars) !== stars) return false
      if (country !== "all" && hotel.country !== country) return false
      return true
    })
    rows.sort((a, b) => {
      if (sortKey === "nameAsc") return a.hotel.name.localeCompare(b.hotel.name)
      if (sortKey === "starsDesc") return b.hotel.stars - a.hotel.stars
      return b.stats.occupancyPercent - a.stats.occupancyPercent
    })
    return rows
  }, [enriched, query, stars, country, sortKey])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Select value={stars} onValueChange={(v) => v && setStars(v)}>
          <SelectTrigger size="sm" className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStars")}</SelectItem>
            <SelectItem value="3">{t("filters.stars3")}</SelectItem>
            <SelectItem value="4">{t("filters.stars4")}</SelectItem>
            <SelectItem value="5">{t("filters.stars5")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={country} onValueChange={(v) => v && setCountry(v)}>
          <SelectTrigger size="sm" className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allCountries")}</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => v && setSortKey(v as SortKey)}>
          <SelectTrigger size="sm" className="h-9 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="occupancyDesc">{t("sort.occupancyDesc")}</SelectItem>
            <SelectItem value="starsDesc">{t("sort.starsDesc")}</SelectItem>
            <SelectItem value="nameAsc">{t("sort.nameAsc")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ hotel, stats }) => (
            <Link
              key={hotel.id}
              to={`/hotels/${hotel.id}`}
              className="block transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
            >
              <HotelCard hotel={hotel} bookedByType={stats.bookedByType} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
