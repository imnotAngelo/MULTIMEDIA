import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface LocalUnit {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  status?: string;
  yearLevel?: number;
  section?: string;
  createdAt?: string;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(moduleDir, '..', '..');
let unitsStoreFilePath = path.join(backendRoot, 'data', 'units.json');

export function setUnitsStoreFile(filePath: string) {
  unitsStoreFilePath = filePath;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
  }
}

function readUnitsStore(): LocalUnit[] {
  try {
    const raw = fs.readFileSync(unitsStoreFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUnitsStore(units: LocalUnit[]) {
  fs.writeFileSync(unitsStoreFilePath, JSON.stringify(units, null, 2));
}

export function createLocalUnit(unit: LocalUnit): LocalUnit {
  const units = readUnitsStore();
  const nextUnit = {
    ...unit,
    createdAt: unit.createdAt || new Date().toISOString(),
  };
  units.push(nextUnit);
  writeUnitsStore(units);
  return nextUnit;
}

export function listLocalUnits(): LocalUnit[] {
  return readUnitsStore();
}

export function getLocalUnitById(id: string): LocalUnit | undefined {
  return readUnitsStore().find((unit) => unit.id === id);
}

export function deleteLocalUnit(id: string) {
  const nextUnits = readUnitsStore().filter((unit) => unit.id !== id);
  writeUnitsStore(nextUnits);
}
