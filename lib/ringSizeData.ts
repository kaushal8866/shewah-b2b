export interface RingSizeEntry {
  us: string
  uk: string
  eu: string
  asia: string // JP, IN, CN
  diameterMm: number
  circumferenceMm: number
}

export const RING_SIZE_DATA: RingSizeEntry[] = [
  { us: '3', uk: 'F', eu: '44', asia: '4', diameterMm: 14.05, circumferenceMm: 44.1 },
  { us: '3.25', uk: 'F 1/2', eu: '45', asia: '4.5', diameterMm: 14.24, circumferenceMm: 44.7 },
  { us: '3.5', uk: 'G', eu: '45.5', asia: '5', diameterMm: 14.45, circumferenceMm: 45.4 },
  { us: '3.75', uk: 'G 1/2', eu: '46', asia: '6', diameterMm: 14.65, circumferenceMm: 46.0 },
  { us: '4', uk: 'H', eu: '46.8', asia: '7', diameterMm: 14.88, circumferenceMm: 46.7 },
  { us: '4.25', uk: 'H 1/2', eu: '47.4', asia: '7.5', diameterMm: 15.09, circumferenceMm: 47.4 },
  { us: '4.5', uk: 'I', eu: '48', asia: '8', diameterMm: 15.29, circumferenceMm: 48.0 },
  { us: '4.75', uk: 'J', eu: '48.7', asia: '8.5', diameterMm: 15.49, circumferenceMm: 48.7 },
  { us: '5', uk: 'J 1/2', eu: '49.3', asia: '9', diameterMm: 15.70, circumferenceMm: 49.3 },
  { us: '5.25', uk: 'K', eu: '50', asia: '9.5', diameterMm: 15.90, circumferenceMm: 50.0 },
  { us: '5.5', uk: 'K 1/2', eu: '50.6', asia: '10', diameterMm: 16.10, circumferenceMm: 50.6 },
  { us: '5.75', uk: 'L', eu: '51.2', asia: '10.5', diameterMm: 16.31, circumferenceMm: 51.2 },
  { us: '6', uk: 'L 1/2', eu: '51.9', asia: '11', diameterMm: 16.51, circumferenceMm: 51.9 },
  { us: '6.25', uk: 'M', eu: '52.5', asia: '12', diameterMm: 16.71, circumferenceMm: 52.5 },
  { us: '6.5', uk: 'M 1/2', eu: '53.1', asia: '13', diameterMm: 16.92, circumferenceMm: 53.1 },
  { us: '6.75', uk: 'N', eu: '53.8', asia: '13.5', diameterMm: 17.12, circumferenceMm: 53.8 },
  { us: '7', uk: 'N 1/2', eu: '54.4', asia: '14', diameterMm: 17.32, circumferenceMm: 54.4 },
  { us: '7.25', uk: 'O', eu: '55.1', asia: '14.5', diameterMm: 17.53, circumferenceMm: 55.1 },
  { us: '7.5', uk: 'O 1/2', eu: '55.7', asia: '15', diameterMm: 17.73, circumferenceMm: 55.7 },
  { us: '7.75', uk: 'P', eu: '56.3', asia: '15.5', diameterMm: 17.93, circumferenceMm: 56.3 },
  { us: '8', uk: 'P 1/2', eu: '57.0', asia: '16', diameterMm: 18.14, circumferenceMm: 57.0 },
  { us: '8.25', uk: 'Q', eu: '57.6', asia: '16.5', diameterMm: 18.34, circumferenceMm: 57.6 },
  { us: '8.5', uk: 'Q 1/2', eu: '58.2', asia: '17', diameterMm: 18.54, circumferenceMm: 58.2 },
  { us: '8.75', uk: 'R', eu: '58.9', asia: '17.5', diameterMm: 18.75, circumferenceMm: 58.9 },
  { us: '9', uk: 'R 1/2', eu: '59.5', asia: '18', diameterMm: 18.95, circumferenceMm: 59.5 },
  { us: '9.25', uk: 'S', eu: '60.1', asia: '18.5', diameterMm: 19.15, circumferenceMm: 60.1 },
  { us: '9.5', uk: 'S 1/2', eu: '60.8', asia: '19', diameterMm: 19.35, circumferenceMm: 60.8 },
  { us: '9.75', uk: 'T', eu: '61.4', asia: '19.5', diameterMm: 19.56, circumferenceMm: 61.4 },
  { us: '10', uk: 'T 1/2', eu: '62.1', asia: '20', diameterMm: 19.76, circumferenceMm: 62.1 },
  { us: '10.25', uk: 'U', eu: '62.7', asia: '21', diameterMm: 19.96, circumferenceMm: 62.7 },
  { us: '10.5', uk: 'U 1/2', eu: '63.4', asia: '22', diameterMm: 20.17, circumferenceMm: 63.4 },
  { us: '10.75', uk: 'V', eu: '64.0', asia: '22.5', diameterMm: 20.37, circumferenceMm: 64.0 },
  { us: '11', uk: 'V 1/2', eu: '64.6', asia: '23', diameterMm: 20.57, circumferenceMm: 64.6 },
  { us: '11.25', uk: 'W', eu: '65.3', asia: '23.5', diameterMm: 20.78, circumferenceMm: 65.3 },
  { us: '11.5', uk: 'W 1/2', eu: '65.9', asia: '24', diameterMm: 20.98, circumferenceMm: 65.9 },
  { us: '11.75', uk: 'X', eu: '66.5', asia: '24.5', diameterMm: 21.18, circumferenceMm: 66.5 },
  { us: '12', uk: 'X 1/2', eu: '67.2', asia: '25', diameterMm: 21.39, circumferenceMm: 67.2 },
  { us: '12.25', uk: 'Y', eu: '67.8', asia: '25.5', diameterMm: 21.59, circumferenceMm: 67.8 },
  { us: '12.5', uk: 'Z', eu: '68.4', asia: '26', diameterMm: 21.79, circumferenceMm: 68.4 },
  { us: '12.75', uk: 'Z 1/2', eu: '69.1', asia: '26.5', diameterMm: 22.00, circumferenceMm: 69.1 },
  { us: '13', uk: 'Z+1', eu: '69.7', asia: '27', diameterMm: 22.20, circumferenceMm: 69.7 },
  { us: '13.25', uk: 'Z+1.5', eu: '70.4', asia: '27.5', diameterMm: 22.40, circumferenceMm: 70.4 },
  { us: '13.5', uk: 'Z+2', eu: '71.0', asia: '28', diameterMm: 22.61, circumferenceMm: 71.0 },
  { us: '13.75', uk: 'Z+2.5', eu: '71.6', asia: '28.5', diameterMm: 22.81, circumferenceMm: 71.6 },
  { us: '14', uk: 'Z+3', eu: '72.3', asia: '29', diameterMm: 23.01, circumferenceMm: 72.3 },
  { us: '14.25', uk: 'Z+3.5', eu: '72.9', asia: '29.5', diameterMm: 23.22, circumferenceMm: 72.9 },
  { us: '14.5', uk: 'Z+4', eu: '73.6', asia: '30', diameterMm: 23.42, circumferenceMm: 73.6 },
  { us: '14.75', uk: 'Z+4.5', eu: '74.2', asia: '30.5', diameterMm: 23.62, circumferenceMm: 74.2 },
  { us: '15', uk: 'Z+5', eu: '76.1', asia: '31', diameterMm: 24.23, circumferenceMm: 76.1 },
]

export const COUNTRY_OPTIONS = [
  { code: 'US', label: 'United States & Canada', standard: 'us', flag: '🇺🇸' },
  { code: 'GB', label: 'United Kingdom & Australia', standard: 'uk', flag: '🇬🇧' },
  { code: 'EU', label: 'Europe (FR, DE, IT, ES, CH)', standard: 'eu', flag: '🇪🇺' },
  { code: 'IN', label: 'India, Japan & China', standard: 'asia', flag: '🇮🇳' },
]
