/** Pure conversion functions — no dataset, no staleness risk. */

export function kmToMiles(km: number): number {
  return km * 0.621371
}

export function milesToKm(miles: number): number {
  return miles / 0.621371
}

export function kgToLbs(kg: number): number {
  return kg * 2.20462
}

export function lbsToKg(lbs: number): number {
  return lbs / 2.20462
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32
}

export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9
}

export function litersToGallons(liters: number): number {
  return liters * 0.264172
}

export function gallonsToLiters(gallons: number): number {
  return gallons / 0.264172
}

export function cmToInches(cm: number): number {
  return cm / 2.54
}

export function inchesToCm(inches: number): number {
  return inches * 2.54
}

export type ConversionUnit =
  | 'km-mi'
  | 'kg-lb'
  | 'c-f'
  | 'l-gal'
  | 'cm-in'

export interface ConversionDef {
  id: ConversionUnit
  label: string
  fromLabel: string
  toLabel: string
  convert: (value: number) => number
  convertBack: (value: number) => number
}

export const CONVERSIONS: ConversionDef[] = [
  {
    id: 'km-mi',
    label: 'Distance',
    fromLabel: 'km',
    toLabel: 'mi',
    convert: kmToMiles,
    convertBack: milesToKm,
  },
  {
    id: 'kg-lb',
    label: 'Weight',
    fromLabel: 'kg',
    toLabel: 'lb',
    convert: kgToLbs,
    convertBack: lbsToKg,
  },
  {
    id: 'c-f',
    label: 'Temperature',
    fromLabel: '°C',
    toLabel: '°F',
    convert: celsiusToFahrenheit,
    convertBack: fahrenheitToCelsius,
  },
  {
    id: 'l-gal',
    label: 'Volume',
    fromLabel: 'L',
    toLabel: 'gal',
    convert: litersToGallons,
    convertBack: gallonsToLiters,
  },
  {
    id: 'cm-in',
    label: 'Length',
    fromLabel: 'cm',
    toLabel: 'in',
    convert: cmToInches,
    convertBack: inchesToCm,
  },
]
