import { useContext } from 'react';
import { DataContext } from '../context/data-context';

export const useData = () => {
    const context = useContext(DataContext);

    if (!context) {
        throw new Error('useData deve ser usado dentro de DataProvider.');
    }

    return context;
};
