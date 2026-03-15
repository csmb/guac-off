import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';

interface ItemProps {
  id: string;
  x: number;
  y: number;
  description: string;
  color: string;
  isCollectible?: boolean;
  nextScene?: string;
  shape?: 'box' | 'avocado';
}

const ItemContainer = styled(motion.div)<{ x: number; y: number; color: string; shape: string }>`
  position: absolute;
  left: ${props => props.x}%;
  top: ${props => props.y}%;
  width: ${props => props.shape === 'avocado' ? '80px' : '100px'};
  height: ${props => props.shape === 'avocado' ? '100px' : '100px'};
  background: ${props => props.color};
  border-radius: ${props => props.shape === 'avocado' ? '50% 50% 50% 50% / 60% 60% 40% 40%' : '10px'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  font-weight: bold;
  box-shadow: 0 0 10px ${props => props.color};
  transition: box-shadow 0.3s ease;
  
  &:hover {
    box-shadow: 0 0 20px ${props => props.color};
  }

  &::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    background: ${props => props.shape === 'avocado' ? '#2E7D32' : 'transparent'};
    border-radius: 50%;
    top: 10px;
    left: 30px;
  }
`;

export const Item = ({ id, x, y, description, color, isCollectible = false, nextScene, shape = 'box' }: ItemProps) => {
  const { addToInventory, setDialogue, setScene } = useGameStore();

  const handleClick = () => {
    setDialogue(description);
    if (isCollectible) {
      addToInventory(id);
    }
    if (nextScene) {
      setScene(nextScene);
    }
  };

  return (
    <ItemContainer
      x={x}
      y={y}
      color={color}
      shape={shape}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
    >
      {shape === 'box' ? id : ''}
    </ItemContainer>
  );
}; 