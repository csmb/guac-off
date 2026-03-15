import { create } from 'zustand';

interface GameState {
  currentScene: string;
  inventory: string[];
  dialogueOpen: boolean;
  currentDialogue: string;
  setScene: (scene: string) => void;
  addToInventory: (item: string) => void;
  removeFromInventory: (item: string) => void;
  setDialogue: (dialogue: string) => void;
  closeDialogue: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentScene: 'start',
  inventory: [],
  dialogueOpen: false,
  currentDialogue: '',
  
  setScene: (scene) => set({ currentScene: scene }),
  
  addToInventory: (item) =>
    set((state) => ({ inventory: [...state.inventory, item] })),
  
  removeFromInventory: (item) =>
    set((state) => ({
      inventory: state.inventory.filter((i) => i !== item),
    })),
  
  setDialogue: (dialogue) =>
    set({ dialogueOpen: true, currentDialogue: dialogue }),
  
  closeDialogue: () => set({ dialogueOpen: false, currentDialogue: '' }),
})); 