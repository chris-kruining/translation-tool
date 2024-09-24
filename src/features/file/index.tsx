import { createContext, useContext } from "solid-js";

const FilesContext = createContext();

export const FilesProvider = (props) => {
    return <FilesContext.Provider value={undefined}>{props.children}</FilesContext.Provider>;
}

export const useFiles = () => useContext(FilesContext);

export const open = () => {

};