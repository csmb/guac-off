import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

const DialogueContainer = styled(motion.div)`
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  padding: 20px;
  border-radius: 10px;
  color: white;
  max-width: 600px;
  width: 90%;
  text-align: center;
  cursor: pointer;
`;

export const Dialogue = () => {
  const { dialogueOpen, currentDialogue, closeDialogue } = useGameStore();

  return (
    <AnimatePresence>
      {dialogueOpen && (
        <DialogueContainer
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          onClick={closeDialogue}
        >
          {currentDialogue}
        </DialogueContainer>
      )}
    </AnimatePresence>
  );
}; 