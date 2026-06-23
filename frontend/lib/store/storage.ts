import createWebStorage from "redux-persist/lib/storage/createWebStorage";

const createNoopStorage = () => {
    return {
        getItem() {
            return Promise.resolve(null)
        },
        setItem(_key: string, value: any) {
            return Promise.resolve(value)
        },
        removeItem(){
            return Promise.resolve()
        },
    }
}

const storage = 
    typeof window !== "undefined"
    ? createWebStorage("local")
    : createNoopStorage()

export default storage