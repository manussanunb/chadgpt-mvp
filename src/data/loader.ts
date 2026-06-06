import type { PolicyItem } from "@/engine/types";

import policyCity from "../../data/embedded/policy_city.json";
import policyEconomy from "../../data/embedded/policy_economy.json";
import policyPeople from "../../data/embedded/policy_people.json";
import policySystem from "../../data/embedded/policy_system.json";
import progressCity from "../../data/embedded/progress_city.json";
import progressEconomy from "../../data/embedded/progress_economy.json";
import progressPeople from "../../data/embedded/progress_people.json";
import progressSystem from "../../data/embedded/progress_system.json";

const ALL_DATA = [
  policyCity,
  policyEconomy,
  policyPeople,
  policySystem,
  progressCity,
  progressEconomy,
  progressPeople,
  progressSystem,
].flat() as PolicyItem[];

let _db: PolicyItem[] | null = null;

export function loadDatabase(): PolicyItem[] {
  if (!_db) _db = ALL_DATA;
  return _db;
}
