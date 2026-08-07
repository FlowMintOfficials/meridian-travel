import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ChecklistStatus,
  ExpenseCategory,
  ItineraryEvent,
  ItineraryEventType,
  MeridianData,
  PackingCategory,
  PackingStatus,
  Settings,
  ThemeMode,
  Trip,
  TripType,
} from '../types'
import {
  createBlankData,
  exportData as serializeData,
  importData as parseData,
  loadData,
  saveData,
  wipe,
} from '../lib/storage'
import { BUILT_IN_TEMPLATES, filterByWeather, templateForType } from '../lib/packingTemplates'
import { fetchRates, isCacheFresh } from '../lib/currency'
import { fetchForecast, findCachedWeather, tagsFromForecast } from '../lib/weather'
import { addDays, makeId, randomTripGradient, todayISO, tripDurationDays } from '../lib/tripHelpers'
import { DEFAULT_CHECKLIST } from '../lib/checklistDefaults'
import { deletePhotoBlobs } from '../lib/photos'

/**
 * useMeridian — single source of truth for the entire app.
 * Reads/writes to localStorage, exposes a stable set of actions.
 */
export function useMeridian() {
  const [data, setData] = useState<MeridianData>(() => loadData())

  useEffect(() => {
    saveData(data)
  }, [data])

  // --------------------------------------------------------------- theme

  const setTheme = useCallback((theme: ThemeMode) => {
    setData((d) => ({ ...d, settings: { ...d.settings, theme } }))
  }, [])

  const toggleTheme = useCallback(() => {
    setData((d) => ({
      ...d,
      settings: { ...d.settings, theme: d.settings.theme === 'dark' ? 'light' : 'dark' },
    }))
  }, [])

  // ---------------------------------------------------------- settings

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }, [])

  const setVaultLock = useCallback((lock: import('../types').VaultLock) => {
    setData((d) => ({ ...d, vaultLock: lock }))
  }, [])

  const clearVaultLock = useCallback(() => {
    setData((d) => {
      const next = { ...d }
      delete next.vaultLock
      return next
    })
  }, [])

  // ------------------------------------------------------------- trips

  const createTrip = useCallback((input: {
    name: string
    type: TripType
    startDate: string
    endDate: string
    homeCurrency: string
    tripCurrency: string
    destinations?: Trip['destinations']
    travelerCount?: number
    travelers?: string[]
    budgetTarget?: number
    timezone?: string
    notes?: string
  }): string => {
    const id = makeId('trip')
    const now = new Date().toISOString()
    const trip: Trip = {
      id,
      name: input.name.trim() || 'New trip',
      type: input.type,
      destinations: input.destinations ?? [],
      startDate: input.startDate,
      endDate: input.endDate,
      homeCurrency: input.homeCurrency,
      tripCurrency: input.tripCurrency,
      travelerCount: input.travelerCount ?? 1,
      travelers: input.travelers ?? [],
      archived: false,
      completed: false,
      createdAt: now,
      updatedAt: now,
      coverGradient: randomTripGradient(id),
      budgetTarget: input.budgetTarget,
      timezone: input.timezone,
      notes: input.notes,
    }
    const checklist = DEFAULT_CHECKLIST.map((title, i) => ({
      id: makeId('chk'),
      tripId: id,
      title,
      status: 'todo' as ChecklistStatus,
      order: i,
    }))
    setData((d) => ({
      ...d,
      trips: [trip, ...d.trips],
      checklist: [...d.checklist, ...checklist],
    }))
    return id
  }, [])

  const updateTrip = useCallback((id: string, patch: Partial<Trip>) => {
    setData((d) => ({
      ...d,
      trips: d.trips.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      ),
    }))
  }, [])

  const archiveTrip = useCallback((id: string) => updateTrip(id, { archived: true }), [updateTrip])
  const unarchiveTrip = useCallback((id: string) => updateTrip(id, { archived: false }), [updateTrip])

  const completeTrip = useCallback(
    (id: string) =>
      updateTrip(id, { completed: true, completedAt: new Date().toISOString() }),
    [updateTrip],
  )

  const reopenTrip = useCallback(
    (id: string) => updateTrip(id, { completed: false, completedAt: undefined }),
    [updateTrip],
  )

  const deleteTrip = useCallback((id: string) => {
    setData((d) => {
      const photoIds = d.photos.filter((p) => p.tripId === id).map((p) => p.id)
      if (photoIds.length) void deletePhotoBlobs(photoIds)
      return {
        ...d,
        trips: d.trips.filter((t) => t.id !== id),
        packing: d.packing.filter((p) => p.tripId !== id),
        itinerary: d.itinerary.filter((e) => e.tripId !== id),
        expenses: d.expenses.filter((e) => e.tripId !== id),
        documents: d.documents.filter((doc) => doc.tripId !== id),
        emergencyContacts: d.emergencyContacts.filter((c) => c.tripId !== id),
        checklist: d.checklist.filter((c) => c.tripId !== id),
        photos: d.photos.filter((p) => p.tripId !== id),
      }
    })
  }, [])

  const duplicateTrip = useCallback((id: string) => {
    setData((d) => {
      const src = d.trips.find((t) => t.id === id)
      if (!src) return d
      const newId = makeId('trip')
      const nowISO = new Date().toISOString()
      const copy: Trip = {
        ...src,
        id: newId,
        name: `${src.name} (copy)`,
        archived: false,
        completed: false,
        completedAt: undefined,
        createdAt: nowISO,
        updatedAt: nowISO,
        coverGradient: randomTripGradient(newId),
      }
      const packingCopies = d.packing
        .filter((p) => p.tripId === id)
        .map((p) => ({ ...p, id: makeId('pk'), tripId: newId, status: 'todo' as PackingStatus }))
      const itineraryCopies = d.itinerary
        .filter((e) => e.tripId === id)
        .map((e) => ({ ...e, id: makeId('itn'), tripId: newId }))
      const checklistCopies = d.checklist
        .filter((c) => c.tripId === id)
        .map((c) => ({
          ...c,
          id: makeId('chk'),
          tripId: newId,
          status: 'todo' as ChecklistStatus,
        }))
      return {
        ...d,
        trips: [copy, ...d.trips],
        packing: [...d.packing, ...packingCopies],
        itinerary: [...d.itinerary, ...itineraryCopies],
        checklist: [...d.checklist, ...checklistCopies],
      }
    })
  }, [])

  // ----------------------------------------------------------- packing

  const seedPackingForTrip = useCallback(
    (tripId: string, type: TripType, weatherTags: string[]) => {
      const template = templateForType(type)
      const items = filterByWeather(template, weatherTags as any)
      const now = Date.now()
      setData((d) => {
        const already = d.packing.some((p) => p.tripId === tripId)
        if (already) return d
        const seeded = items.map((it, i) => ({
          id: makeId('pk'),
          tripId,
          name: it.name,
          category: it.category,
          quantity: it.quantity,
          status: 'todo' as PackingStatus,
          essential: it.essential,
          order: now + i,
        }))
        return { ...d, packing: [...d.packing, ...seeded] }
      })
    },
    [],
  )

  const addPackingItem = useCallback(
    (tripId: string, name: string, category: PackingCategory = 'other', quantity = 1) => {
      const item = {
        id: makeId('pk'),
        tripId,
        name: name.trim(),
        category,
        quantity,
        status: 'todo' as PackingStatus,
        essential: false,
        order: Date.now(),
      }
      setData((d) => ({ ...d, packing: [...d.packing, item] }))
      return item.id
    },
    [],
  )

  const updatePackingItem = useCallback(
    (id: string, patch: Partial<{ name: string; category: PackingCategory; quantity: number; status: PackingStatus; essential: boolean; notes: string }>) => {
      setData((d) => ({
        ...d,
        packing: d.packing.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }))
    },
    [],
  )

  const togglePackingStatus = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      packing: d.packing.map((p) => {
        if (p.id !== id) return p
        const next: PackingStatus = p.status === 'packed' ? 'todo' : 'packed'
        return { ...p, status: next }
      }),
    }))
  }, [])

  const deletePackingItem = useCallback((id: string) => {
    setData((d) => ({ ...d, packing: d.packing.filter((p) => p.id !== id) }))
  }, [])

  const resetPacking = useCallback((tripId: string) => {
    setData((d) => ({
      ...d,
      packing: d.packing.map((p) =>
        p.tripId === tripId ? { ...p, status: 'todo' as PackingStatus } : p,
      ),
    }))
  }, [])

  /** Mark every still-todo packing item as skipped (didn’t bring). */
  const skipUnresolvedPacking = useCallback((tripId: string) => {
    setData((d) => ({
      ...d,
      packing: d.packing.map((p) =>
        p.tripId === tripId && p.status === 'todo'
          ? { ...p, status: 'skip' as PackingStatus }
          : p,
      ),
    }))
  }, [])

  const clearPacking = useCallback((tripId: string) => {
    setData((d) => ({ ...d, packing: d.packing.filter((p) => p.tripId !== tripId) }))
  }, [])

  const saveAsTemplate = useCallback((tripId: string, name: string) => {
    setData((d) => {
      const trip = d.trips.find((t) => t.id === tripId)
      if (!trip) return d
      const items = d.packing
        .filter((p) => p.tripId === tripId && p.status !== 'skip')
        .map((p) => ({
          name: p.name,
          category: p.category,
          quantity: p.quantity,
          essential: p.essential,
        }))
      const tpl = {
        id: makeId('tpl'),
        name: name.trim() || `${trip.name} — packing list`,
        tripType: trip.type,
        builtin: false,
        items,
      }
      return { ...d, customTemplates: [tpl, ...d.customTemplates] }
    })
  }, [])

  // ---------------------------------------------------------- itinerary

  const addItineraryEvent = useCallback(
    (
      tripId: string,
      input: {
        day: number
        title: string
        type?: ItineraryEventType
        startTime?: string
        endTime?: string
        address?: string
        notes?: string
        cost?: number
        costCurrency?: string
        bookingRef?: string
        bookingUrl?: string
        carrier?: string
        flightNumber?: string
        departureStation?: string
        arrivalStation?: string
        terminal?: string
        gate?: string
        seat?: string
      },
    ) => {
      const evt: ItineraryEvent = {
        id: makeId('itn'),
        tripId,
        day: input.day,
        title: input.title.trim(),
        type: input.type ?? 'activity',
        startTime: input.startTime,
        endTime: input.endTime,
        address: input.address,
        notes: input.notes,
        cost: input.cost,
        costCurrency: input.costCurrency,
        bookingRef: input.bookingRef,
        bookingUrl: input.bookingUrl,
        carrier: input.carrier,
        flightNumber: input.flightNumber,
        departureStation: input.departureStation,
        arrivalStation: input.arrivalStation,
        terminal: input.terminal,
        gate: input.gate,
        seat: input.seat,
        order: Date.now(),
      }
      setData((d) => ({ ...d, itinerary: [...d.itinerary, evt] }))
      return evt.id
    },
    [],
  )

  const updateItineraryEvent = useCallback(
    (id: string, patch: Partial<Omit<import('../types').ItineraryEvent, 'id' | 'tripId'>>) => {
      setData((d) => ({
        ...d,
        itinerary: d.itinerary.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }))
    },
    [],
  )

  const deleteItineraryEvent = useCallback((id: string) => {
    setData((d) => ({ ...d, itinerary: d.itinerary.filter((e) => e.id !== id) }))
  }, [])

  /** Re-inserts an event deleted a moment ago — powers the "Undo" toast action. */
  const restoreItineraryEvent = useCallback((evt: ItineraryEvent) => {
    setData((d) =>
      d.itinerary.some((e) => e.id === evt.id)
        ? d
        : { ...d, itinerary: [...d.itinerary, evt] },
    )
  }, [])

  // ----------------------------------------------------------- expenses

  const addExpense = useCallback(
    (
      tripId: string,
      input: {
        amount: number
        currency: string
        category: ExpenseCategory
        description: string
        date?: string
        paidBy?: string
        splitWith?: string[]
      },
    ) => {
      const exp = {
        id: makeId('exp'),
        tripId,
        date: input.date ?? todayISO(),
        amount: input.amount,
        currency: input.currency,
        category: input.category,
        description: input.description.trim(),
        paidBy: input.paidBy,
        splitWith: input.splitWith,
        createdAt: new Date().toISOString(),
      }
      setData((d) => ({ ...d, expenses: [exp, ...d.expenses] }))
      return exp.id
    },
    [],
  )

  const updateExpense = useCallback(
    (id: string, patch: Partial<Omit<import('../types').Expense, 'id' | 'tripId' | 'createdAt'>>) => {
      setData((d) => ({
        ...d,
        expenses: d.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }))
    },
    [],
  )

  const deleteExpense = useCallback((id: string) => {
    setData((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }))
  }, [])

  /** Re-inserts an expense deleted a moment ago — powers the "Undo" toast action. */
  const restoreExpense = useCallback((exp: import('../types').Expense) => {
    setData((d) =>
      d.expenses.some((e) => e.id === exp.id) ? d : { ...d, expenses: [exp, ...d.expenses] },
    )
  }, [])

  // ---------------------------------------------------------- checklist

  const addChecklistItem = useCallback((tripId: string, title: string) => {
    const item = {
      id: makeId('chk'),
      tripId,
      title: title.trim(),
      status: 'todo' as ChecklistStatus,
      order: Date.now(),
    }
    setData((d) => ({ ...d, checklist: [...d.checklist, item] }))
    return item.id
  }, [])

  const updateChecklistItem = useCallback(
    (
      id: string,
      patch: Partial<Omit<import('../types').ChecklistItem, 'id' | 'tripId'>>,
    ) => {
      setData((d) => ({
        ...d,
        checklist: d.checklist.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }))
    },
    [],
  )

  const toggleChecklistItem = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      checklist: d.checklist.map((c) => {
        if (c.id !== id) return c
        const status: ChecklistStatus = c.status === 'done' ? 'todo' : 'done'
        return { ...c, status }
      }),
    }))
  }, [])

  const deleteChecklistItem = useCallback((id: string) => {
    setData((d) => ({ ...d, checklist: d.checklist.filter((c) => c.id !== id) }))
  }, [])

  const seedChecklistForTrip = useCallback((tripId: string) => {
    setData((d) => {
      if (d.checklist.some((c) => c.tripId === tripId)) return d
      const seeded = DEFAULT_CHECKLIST.map((title, i) => ({
        id: makeId('chk'),
        tripId,
        title,
        status: 'todo' as ChecklistStatus,
        order: i,
      }))
      return { ...d, checklist: [...d.checklist, ...seeded] }
    })
  }, [])

  // -------------------------------------------------------------- photos

  const addPhotoMeta = useCallback((photo: import('../types').TripPhoto) => {
    setData((d) => ({ ...d, photos: [photo, ...d.photos] }))
    return photo.id
  }, [])

  const updatePhotoMeta = useCallback(
    (id: string, patch: Partial<Pick<import('../types').TripPhoto, 'caption' | 'day'>>) => {
      setData((d) => ({
        ...d,
        photos: d.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }))
    },
    [],
  )

  const deletePhoto = useCallback((id: string) => {
    void deletePhotoBlobs([id])
    setData((d) => ({ ...d, photos: d.photos.filter((p) => p.id !== id) }))
  }, [])

  // ---------------------------------------------------- docs & contacts

  const addDocument = useCallback((doc: import('../types').EncryptedDocument) => {
    setData((d) => ({ ...d, documents: [doc, ...d.documents] }))
    return doc.id
  }, [])

  const deleteDocument = useCallback((id: string) => {
    setData((d) => ({ ...d, documents: d.documents.filter((doc) => doc.id !== id) }))
  }, [])

  const addEmergencyContact = useCallback(
    (
      tripId: string,
      input: {
        label: string
        detail: string
        kind?: import('../types').EmergencyContact['kind']
      },
    ) => {
      const contact = {
        id: makeId('emg'),
        tripId,
        label: input.label.trim(),
        detail: input.detail.trim(),
        kind: input.kind ?? 'other',
      }
      setData((d) => ({
        ...d,
        emergencyContacts: [...d.emergencyContacts, contact],
      }))
      return contact.id
    },
    [],
  )

  const updateEmergencyContact = useCallback(
    (
      id: string,
      patch: Partial<Omit<import('../types').EmergencyContact, 'id' | 'tripId'>>,
    ) => {
      setData((d) => ({
        ...d,
        emergencyContacts: d.emergencyContacts.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
      }))
    },
    [],
  )

  const deleteEmergencyContact = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      emergencyContacts: d.emergencyContacts.filter((c) => c.id !== id),
    }))
  }, [])

  // ---------------------------------------------------- currency rates

  const refreshRates = useCallback(async (base: string, force = false) => {
    if (!force && isCacheFresh(data.cachedRates, base)) return data.cachedRates!
    try {
      const rates = await fetchRates(base)
      setData((d) => ({ ...d, cachedRates: rates }))
      return rates
    } catch (err) {
      console.warn('[meridian] rate refresh failed', err)
      return data.cachedRates
    }
  }, [data.cachedRates])

  // ------------------------------------------------------------ weather

  const refreshWeatherForTrip = useCallback(async (tripId: string) => {
    const trip = data.trips.find((t) => t.id === tripId)
    if (!trip) return null
    const dest = trip.destinations[0]
    if (!dest || dest.latitude == null || dest.longitude == null) return null
    const cached = findCachedWeather(data.cachedWeather, dest.latitude, dest.longitude)
    if (cached) return cached
    try {
      const forecast = await fetchForecast(
        dest.latitude,
        dest.longitude,
        trip.startDate,
        trip.endDate,
      )
      setData((d) => ({
        ...d,
        cachedWeather: [
          forecast,
          ...d.cachedWeather.filter((c) => c.key !== forecast.key),
        ].slice(0, 20),
      }))
      return forecast
    } catch (err) {
      console.warn('[meridian] weather refresh failed', err)
      return null
    }
  }, [data.trips, data.cachedWeather])

  // ------------------------------------------------------- import/export

  const replaceData = useCallback((json: string) => {
    setData(parseData(json))
  }, [])

  const resetAll = useCallback(() => {
    wipe()
    setData(createBlankData())
  }, [])

  /** Serialize the current store to a Blob for download. */
  const exportData = useCallback((): Blob => {
    const json = serializeData(data)
    return new Blob([json], { type: 'application/json' })
  }, [data])

  /**
   * Merge an already-parsed backup with the current store. Returns
   * an ok/error result plus the number of *new* records added.
   */
  const importData = useCallback(
    (parsed: unknown): { ok: boolean; added: number; error?: string } => {
      if (typeof parsed !== 'object' || parsed === null) {
        return { ok: false, added: 0, error: 'File does not look like a Meridian backup.' }
      }
      try {
        const json = JSON.stringify(parsed)
        const incoming = parseData(json)
        let added = 0
        setData((prev) => {
          const merged: MeridianData = {
            ...prev,
            trips: mergeById(prev.trips, incoming.trips, () => (added += 1)),
            packing: mergeById(prev.packing, incoming.packing, () => (added += 1)),
            itinerary: mergeById(prev.itinerary, incoming.itinerary, () => (added += 1)),
            expenses: mergeById(prev.expenses, incoming.expenses, () => (added += 1)),
            documents: mergeById(prev.documents, incoming.documents, () => (added += 1)),
            emergencyContacts: mergeById(
              prev.emergencyContacts,
              incoming.emergencyContacts,
              () => (added += 1),
            ),
            checklist: mergeById(prev.checklist, incoming.checklist, () => (added += 1)),
            photos: mergeById(prev.photos, incoming.photos, () => (added += 1)),
            customTemplates: mergeById(
              prev.customTemplates,
              incoming.customTemplates,
              () => (added += 1),
            ),
            settings: incoming.settings ?? prev.settings,
            vaultLock: incoming.vaultLock ?? prev.vaultLock,
          }
          return merged
        })
        return { ok: true, added }
      } catch (err) {
        return {
          ok: false,
          added: 0,
          error: (err as Error).message || 'Import failed.',
        }
      }
    },
    [],
  )

  /** Alias with an intent-revealing name for the Settings view. */
  const wipeAll = resetAll

  // ------------------------------------------------------------- output

  const value = useMemo(
    () => ({
      data,
      // theme
      setTheme,
      toggleTheme,
      // settings
      updateSettings,
      setVaultLock,
      clearVaultLock,
      // trips
      createTrip,
      updateTrip,
      archiveTrip,
      unarchiveTrip,
      completeTrip,
      reopenTrip,
      deleteTrip,
      duplicateTrip,
      // packing
      seedPackingForTrip,
      addPackingItem,
      updatePackingItem,
      togglePackingStatus,
      deletePackingItem,
      resetPacking,
      skipUnresolvedPacking,
      clearPacking,
      saveAsTemplate,
      // itinerary
      addItineraryEvent,
      updateItineraryEvent,
      deleteItineraryEvent,
      restoreItineraryEvent,
      // expenses
      addExpense,
      updateExpense,
      deleteExpense,
      restoreExpense,
      // checklist
      addChecklistItem,
      updateChecklistItem,
      toggleChecklistItem,
      deleteChecklistItem,
      seedChecklistForTrip,
      // photos
      addPhotoMeta,
      updatePhotoMeta,
      deletePhoto,
      // docs & contacts
      addDocument,
      deleteDocument,
      addEmergencyContact,
      updateEmergencyContact,
      deleteEmergencyContact,
      // network
      refreshRates,
      refreshWeatherForTrip,
      // import/export
      replaceData,
      resetAll,
      exportData,
      importData,
      wipeAll,
      // convenience
      templates: BUILT_IN_TEMPLATES,
      derived: {
        tagsFromForecast,
        tripDurationDays,
        addDays,
      },
    }),
    [
      data,
      setTheme,
      toggleTheme,
      updateSettings,
      setVaultLock,
      clearVaultLock,
      createTrip,
      updateTrip,
      archiveTrip,
      unarchiveTrip,
      completeTrip,
      reopenTrip,
      deleteTrip,
      duplicateTrip,
      seedPackingForTrip,
      addPackingItem,
      updatePackingItem,
      togglePackingStatus,
      deletePackingItem,
      resetPacking,
      skipUnresolvedPacking,
      clearPacking,
      saveAsTemplate,
      addItineraryEvent,
      updateItineraryEvent,
      deleteItineraryEvent,
      restoreItineraryEvent,
      addExpense,
      updateExpense,
      deleteExpense,
      restoreExpense,
      addChecklistItem,
      updateChecklistItem,
      toggleChecklistItem,
      deleteChecklistItem,
      seedChecklistForTrip,
      addPhotoMeta,
      updatePhotoMeta,
      deletePhoto,
      addDocument,
      deleteDocument,
      addEmergencyContact,
      updateEmergencyContact,
      deleteEmergencyContact,
      refreshRates,
      refreshWeatherForTrip,
      replaceData,
      resetAll,
      exportData,
      importData,
      wipeAll,
    ],
  )

  return value
}

/** Merge two arrays of records that share an `id` field. Existing ids
 * are updated in-place; new ids are appended. `onAdd` is called once
 * per record that was appended, so callers can count them. */
function mergeById<T extends { id: string }>(
  base: T[],
  incoming: T[],
  onAdd: () => void,
): T[] {
  if (incoming.length === 0) return base
  const map = new Map(base.map((row) => [row.id, row] as const))
  for (const row of incoming) {
    if (!map.has(row.id)) onAdd()
    map.set(row.id, row)
  }
  return Array.from(map.values())
}

export type MeridianStore = ReturnType<typeof useMeridian>
