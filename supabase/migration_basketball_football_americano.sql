-- Rodri Tips — migração: Basquetebol e Futebol Americano
-- Corre isto no SQL Editor do teu projeto Supabase já existente
--
-- A coluna `sport` só aceita uma lista fixa de valores (restrição "check").
-- Sem isto, a base de dados recusa guardar apostas destas modalidades novas.

alter table public.bets drop constraint if exists bets_sport_check;

alter table public.bets add constraint bets_sport_check
  check (sport in ('Tennis','Handball','MMA','Football','Basketball','AmericanFootball'));

-- Nota: se o nome da restrição não for "bets_sport_check" no teu projeto
-- (podes confirmar em Database → Tables → bets → separador "Constraints"),
-- troca o nome no "drop constraint" acima pelo que lá vir.
