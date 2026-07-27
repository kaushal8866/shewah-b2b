import { OntologyTerm } from '../types/agent'

/**
 * AURORA Ontology & Taxonomy Service
 * Standardizes jewelry terminology across aesthetic, metal karat, setting, and gemstone attributes.
 */
class OntologyService {
  private terms: Map<string, OntologyTerm> = new Map()

  constructor() {
    this.seedOntologyData()
  }

  private seedOntologyData() {
    const defaultTerms: OntologyTerm[] = [
      {
        id: 'ont_karat_18',
        category: 'karat',
        standardName: '18K Gold',
        synonyms: ['18k', '18K', '750', '18kt', '18 Karat'],
        definition: '75.0% pure gold alloyed with silver, copper, or palladium for optimal strength and rich color.',
      },
      {
        id: 'ont_karat_14',
        category: 'karat',
        standardName: '14K Gold',
        synonyms: ['14k', '14K', '585', '14kt', '14 Karat'],
        definition: '58.5% pure gold alloy offering maximum durability for daily wear jewelry.',
      },
      {
        id: 'ont_setting_pave',
        category: 'setting',
        standardName: 'Pavé Setting',
        synonyms: ['pave', 'micro-pave', 'micropavé', 'paved diamond'],
        definition: 'Small diamonds set closely together with tiny metal beads to create a continuous paved diamond surface.',
      },
      {
        id: 'ont_setting_bezel',
        category: 'setting',
        standardName: 'Bezel Setting',
        synonyms: ['bezel', 'rub-over setting', 'full bezel', 'half bezel'],
        definition: 'A custom metal rim surrounding the gemstone perimeter to secure it tightly while offering high protection.',
      },
      {
        id: 'ont_cut_oval',
        category: 'gem_cut',
        standardName: 'Oval Brilliant Cut',
        synonyms: ['oval', 'oval cut', 'oval diamond', 'oval modified brilliant'],
        definition: 'Elongated rounded brilliant gemstone shape known for maximizing perceived surface area and finger length.',
      },
      {
        id: 'ont_aesthetic_artdeco',
        category: 'aesthetic',
        standardName: 'Art Deco Revival',
        synonyms: ['art deco', 'vintage art deco', 'geometric vintage', '1920s style'],
        definition: 'Symmetrical geometric motifs, bold lines, filigree accents, and contrasting gemstone combinations.',
      },
    ]

    for (const t of defaultTerms) this.terms.set(t.id, t)
  }

  public standardize(term: string): string {
    const q = term.toLowerCase().trim()
    // Array.from rather than iterating the Map directly: this tsconfig has no
    // `downlevelIteration`, so a bare Map iterator does not compile.
    for (const item of Array.from(this.terms.values())) {
      if (item.standardName.toLowerCase() === q) return item.standardName
      if (item.synonyms.some((s: string) => s.toLowerCase() === q)) return item.standardName
    }
    return term // Return original if canonical term not found
  }

  public getAllTerms(): OntologyTerm[] {
    return Array.from(this.terms.values())
  }
}

export const ontologyService = new OntologyService()
