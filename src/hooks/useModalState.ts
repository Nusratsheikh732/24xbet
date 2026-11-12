import { useSyncExternalStore } from 'react';

let count = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function openModal() {
  count++;
  emit();
}

export function closeModal() {
  if (count > 0) {
    count--;
    emit();
  }
}

function getSnapshot() {
  return count;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useModalActive() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot) > 0;
}
