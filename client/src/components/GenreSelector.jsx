import { motion } from 'framer-motion';
import { GENRES_LIST } from '../utils/constants';

const GenreSelector = ({ selectedGenres, onToggle }) => {
  return (
    <div className="genre-grid-container">
      {GENRES_LIST.map((g) => {
        const isSelected = selectedGenres.includes(g.id);
        return (
          <motion.div
            key={g.id}
            className="genre-box"
            onClick={() => onToggle(g.id)}
            whileTap={{ scale: 0.95 }}
            animate={{
              backgroundColor: isSelected ? "#e50914" : "#222",
              color: isSelected ? "#fff" : "#888",
              borderColor: isSelected ? "#ff4757" : "#333",
              scale: isSelected ? 1.05 : 1
            }}
          >
            {g.name}
          </motion.div>
        );
      })}
    </div>
  );
};

export default GenreSelector;