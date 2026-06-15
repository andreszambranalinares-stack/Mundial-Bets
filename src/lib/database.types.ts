// Tipos de la base de datos (escritos a mano, alineados con las migraciones).
// Si más adelante usas la CLI: `supabase gen types typescript` los regenera.

export type Market = 'h2h' | 'totals'
export type Selection = 'home' | 'draw' | 'away' | 'over' | 'under'
export type MatchStatus = 'scheduled' | 'live' | 'finished'
export type BetStatus = 'pending' | 'won' | 'lost' | 'void' | 'cashed_out'
export type LegStatus = 'pending' | 'won' | 'lost' | 'void'

// Nota: usamos `type` (no `interface`) a propósito. supabase-js exige que las
// filas sean asignables a `Record<string, unknown>`, y las interfaces no lo son
// (no tienen firma de índice implícita); los alias de tipo sí.
export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  onboarding_done: boolean
  theme: 'system' | 'light' | 'dark'
  created_at: string
}

export type League = {
  id: string
  name: string
  invite_code: string
  owner_id: string
  starting_chips: number
  image_url: string | null
  invite_active: boolean
  created_at: string
}

// Vista pública mínima de una liga, obtenida por código de invitación.
export type LeaguePublic = {
  id: string
  name: string
  image_url: string | null
  invite_active: boolean
  members: number
}

export type LeagueMember = {
  league_id: string
  user_id: string
  balance: number
  joined_at: string
}

export type Match = {
  id: string
  sport_key: string | null
  home_team: string
  away_team: string
  commence_time: string
  status: MatchStatus
  home_score: number | null
  away_score: number | null
  minute: number | null
  period: 'regular' | 'half_time' | 'extra_time' | 'penalties' | null
  last_odds_update: string | null
  scores_updated_at: string | null
  created_at: string
}

export type MatchOdds = {
  id: number
  match_id: string
  market: Market
  selection: Selection
  point: number
  price: number
  updated_at: string
}

// Una apuesta es ahora un "boleto" (cabecera): un stake, una cuota combinada
// y un estado. Las selecciones viven en bet_legs (1 pata = simple, 2+ = combinada).
export type Bet = {
  id: string
  league_id: string
  user_id: string
  match_id: string | null
  market: Market | null
  selection: Selection | null
  point: number
  odds_taken: number | null
  stake: number
  potential_payout: number
  num_legs: number
  combined_odds: number | null
  cashout_value: number | null
  settled_payout: number | null
  status: BetStatus
  placed_at: string
  settled_at: string | null
}

export type BetLeg = {
  id: number
  bet_id: string
  match_id: string
  market: string
  selection: string
  point: number
  odds_taken: number
  label: string | null
  player_name: string | null
  status: LegStatus
  settled_at: string | null
}

// Catálogo de mercados avanzados con cuota fija (Func 2).
export type AdvancedOdd = {
  id: number
  category: string
  market: string
  selection: string
  label: string
  needs_player: boolean
  price: number
  sort: number
}

export type LeagueMessage = {
  id: number
  league_id: string
  user_id: string
  content: string
  created_at: string
}

// Quiniela / Pool por jornada (B1)
export type PoolStatus = 'open' | 'locked' | 'settled'
export type Pool = {
  id: string
  league_id: string
  name: string
  jornada_date: string | null
  entry_fee: number
  status: PoolStatus
  created_by: string
  created_at: string
}
export type PoolMatch = {
  pool_id: string
  match_id: string
}
export type PoolEntry = {
  id: string
  pool_id: string
  user_id: string
  points: number
  paid_at: string
}
export type PoolPrediction = {
  entry_id: string
  match_id: string
  pred_home: number
  pred_away: number
}

// Apuestas de futuro (B2): catálogo + apuesta del usuario
export type FutureOdd = {
  id: number
  market: string
  selection: string
  label: string
  price: number
  sort: number
}
export type FuturesBet = {
  id: string
  league_id: string
  user_id: string
  market: string
  selection: string
  label: string
  odds_taken: number
  stake: number
  status: 'pending' | 'won' | 'lost'
  placed_at: string
  settled_at: string | null
}

export type ActivityType =
  | 'member_joined'
  | 'bet_placed'
  | 'bet_won'
  | 'bet_lost'
  | 'pool_joined'
  | 'pool_settled'
  | 'jornada_recap'
export type LeagueActivity = {
  id: number
  league_id: string
  user_id: string
  type: ActivityType
  payload: Record<string, unknown>
  created_at: string
}

// Una selección que el usuario ha metido en la hoja de apuesta (cliente).
// Para mercados avanzados, market/selection son claves del catálogo y se
// acompañan de label (texto a mostrar) y, si aplica, playerName.
export type SlipLeg = {
  match: Match
  market: string
  selection: string
  point: number
  price: number
  label?: string
  playerName?: string
}

// Tipado para createClient<Database>. La forma (Tables/Views/Functions/Enums/
// CompositeTypes con Relationships) es la que espera supabase-js; si falta algo
// el cliente infiere `never`. Las escrituras van por RPC, no por inserts directos.
type Tbl<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] }

export interface Database {
  public: {
    Tables: {
      profiles: Tbl<Profile>
      leagues: Tbl<League>
      league_members: Tbl<LeagueMember>
      matches: Tbl<Match>
      match_odds: Tbl<MatchOdds>
      bets: Tbl<Bet>
      bet_legs: Tbl<BetLeg>
      league_messages: Tbl<LeagueMessage>
      league_activity: Tbl<LeagueActivity>
      advanced_odds: Tbl<AdvancedOdd>
      pools: Tbl<Pool>
      pool_matches: Tbl<PoolMatch>
      pool_entries: Tbl<PoolEntry>
      pool_predictions: Tbl<PoolPrediction>
      future_odds: Tbl<FutureOdd>
      futures_bets: Tbl<FuturesBet>
    }
    Views: Record<string, never>
    Functions: {
      create_league: { Args: { p_name: string; p_starting_chips?: number }; Returns: League }
      join_league: { Args: { p_invite_code: string }; Returns: League }
      place_bet: {
        Args: {
          p_league_id: string
          p_match_id: string
          p_market: Market
          p_selection: Selection
          p_point: number
          p_stake: number
        }
        Returns: Bet
      }
      place_combo_bet: {
        Args: {
          p_league_id: string
          p_stake: number
          p_legs: {
            match_id: string
            market: string
            selection: string
            point: number
            player_name?: string
          }[]
        }
        Returns: Bet
      }
      cashout_prematch: { Args: { p_bet_id: string }; Returns: number }
      spin_rescue_wheel: { Args: { p_league_id: string }; Returns: number }
      leave_league: { Args: { p_league_id: string }; Returns: undefined }
      delete_league: { Args: { p_league_id: string }; Returns: undefined }
      set_league_image: { Args: { p_league_id: string; p_image_url: string }; Returns: League }
      set_invite_active: { Args: { p_league_id: string; p_active: boolean }; Returns: League }
      get_league_by_invite: { Args: { p_invite_code: string }; Returns: LeaguePublic[] }
      league_history: {
        Args: { p_league_id: string }
        Returns: { jornada: number; jornada_date: string; user_id: string; balance: number }[]
      }
      settle_advanced: {
        Args: {
          p_league_id: string
          p_match_id: string
          p_market: string
          p_selection: string
          p_player_name: string | null
          p_result: 'won' | 'lost' | 'void'
        }
        Returns: number
      }
      create_pool: {
        Args: {
          p_league_id: string
          p_name: string
          p_jornada_date: string | null
          p_entry_fee: number
          p_match_ids: string[]
        }
        Returns: Pool
      }
      join_pool: {
        Args: { p_pool_id: string; p_predictions: { match_id: string; home: number; away: number }[] }
        Returns: PoolEntry
      }
      lock_pool: { Args: { p_pool_id: string }; Returns: undefined }
      settle_pool: { Args: { p_pool_id: string }; Returns: undefined }
      pool_results: {
        Args: { p_pool_id: string }
        Returns: { user_id: string; points: number }[]
      }
      place_future: {
        Args: { p_league_id: string; p_market: string; p_selection: string; p_stake: number }
        Returns: FuturesBet
      }
      settle_future: {
        Args: { p_league_id: string; p_market: string; p_winner: string }
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
