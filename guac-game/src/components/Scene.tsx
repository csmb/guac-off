import styled from '@emotion/styled';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface SceneProps {
  children: ReactNode;
  background: string | ReactNode;
}

const SceneContainer = styled(motion.div)<{ background: string | ReactNode }>`
  width: 100vw;
  height: 100vh;
  background-size: cover;
  background-position: center;
  position: relative;
  cursor: pointer;
  background-repeat: no-repeat;
  background-attachment: fixed;
  overflow: hidden;
  ${props => typeof props.background === 'string' ? `background-image: url(${props.background});` : ''}
`;

const BackgroundImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
`;

export const Scene = ({ children, background }: SceneProps) => {
  return (
    <SceneContainer
      background={background}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {typeof background === 'string' && <BackgroundImage src={background} alt="Background" />}
      {typeof background !== 'string' && background}
      {children}
    </SceneContainer>
  );
}; 