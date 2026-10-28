import { useSyncExternalStore } from 'react';
import {
  getClothingUploadState,
  subscribeClothingUploads,
} from '@/pages/Closet/clothingUploadStore';

const useClothingUploads = () =>
  useSyncExternalStore(subscribeClothingUploads, getClothingUploadState);

export default useClothingUploads;
