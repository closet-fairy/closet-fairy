import AddAPhoto from '@material-symbols/svg-400/outlined/add_a_photo.svg?react';
import ArrowBack from '@material-symbols/svg-400/outlined/arrow_back.svg?react';
import ArrowForward from '@material-symbols/svg-400/outlined/arrow_forward.svg?react';
import Brush from '@material-symbols/svg-400/outlined/brush.svg?react';
import Cancel from '@material-symbols/svg-400/outlined/cancel.svg?react';
import ChatBubble from '@material-symbols/svg-400/outlined/chat_bubble.svg?react';
import Check from '@material-symbols/svg-400/outlined/check.svg?react';
import CheckCircleFill from '@material-symbols/svg-400/outlined/check_circle-fill.svg?react';
import Checkroom from '@material-symbols/svg-400/outlined/checkroom.svg?react';
import CheckroomFill from '@material-symbols/svg-400/outlined/checkroom-fill.svg?react';
import ChevronLeft from '@material-symbols/svg-400/outlined/chevron_left.svg?react';
import ChevronRight from '@material-symbols/svg-400/outlined/chevron_right.svg?react';
import Close from '@material-symbols/svg-400/outlined/close.svg?react';
import Edit from '@material-symbols/svg-400/outlined/edit.svg?react';
import EditLocationAlt from '@material-symbols/svg-400/outlined/edit_location_alt.svg?react';
import ErrorIcon from '@material-symbols/svg-400/outlined/error.svg?react';
import Exposure from '@material-symbols/svg-400/outlined/exposure.svg?react';
import FitScreen from '@material-symbols/svg-400/outlined/fit_screen.svg?react';
import History from '@material-symbols/svg-400/outlined/history.svg?react';
import HistoryFill from '@material-symbols/svg-400/outlined/history-fill.svg?react';
import Image from '@material-symbols/svg-400/outlined/image.svg?react';
import Info from '@material-symbols/svg-400/outlined/info.svg?react';
import InkEraser from '@material-symbols/svg-400/outlined/ink_eraser.svg?react';
import KeyboardArrowUp from '@material-symbols/svg-400/outlined/keyboard_arrow_up.svg?react';
import Layers from '@material-symbols/svg-400/outlined/layers.svg?react';
import LocationOn from '@material-symbols/svg-400/outlined/location_on.svg?react';
import Logout from '@material-symbols/svg-400/outlined/logout.svg?react';
import MyLocation from '@material-symbols/svg-400/outlined/my_location.svg?react';
import Person from '@material-symbols/svg-400/outlined/person.svg?react';
import PersonFill from '@material-symbols/svg-400/outlined/person-fill.svg?react';
import PersonRemove from '@material-symbols/svg-400/outlined/person_remove.svg?react';
import ProgressActivity from '@material-symbols/svg-400/outlined/progress_activity.svg?react';
import RadioButtonUnchecked from '@material-symbols/svg-400/outlined/radio_button_unchecked.svg?react';
import Redo from '@material-symbols/svg-400/outlined/redo.svg?react';
import Refresh from '@material-symbols/svg-400/outlined/refresh.svg?react';
import RestartAlt from '@material-symbols/svg-400/outlined/restart_alt.svg?react';
import RotateLeft from '@material-symbols/svg-400/outlined/rotate_left.svg?react';
import RotateRight from '@material-symbols/svg-400/outlined/rotate_right.svg?react';
import Search from '@material-symbols/svg-400/outlined/search.svg?react';
import Star from '@material-symbols/svg-400/outlined/star.svg?react';
import StarFill from '@material-symbols/svg-400/outlined/star-fill.svg?react';
import StarShine from '@material-symbols/svg-400/outlined/star_shine.svg?react';
import StarShineFill from '@material-symbols/svg-400/outlined/star_shine-fill.svg?react';
import Undo from '@material-symbols/svg-400/outlined/undo.svg?react';

export const icons = {
  add_a_photo: AddAPhoto,
  arrow_back: ArrowBack,
  arrow_forward: ArrowForward,
  brush: Brush,
  cancel: Cancel,
  chat_bubble: ChatBubble,
  check: Check,
  'check_circle-fill': CheckCircleFill,
  checkroom: Checkroom,
  'checkroom-fill': CheckroomFill,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: Close,
  edit: Edit,
  edit_location_alt: EditLocationAlt,
  error: ErrorIcon,
  exposure: Exposure,
  fit_screen: FitScreen,
  history: History,
  'history-fill': HistoryFill,
  image: Image,
  info: Info,
  ink_eraser: InkEraser,
  keyboard_arrow_up: KeyboardArrowUp,
  layers: Layers,
  location_on: LocationOn,
  logout: Logout,
  my_location: MyLocation,
  person: Person,
  'person-fill': PersonFill,
  person_remove: PersonRemove,
  progress_activity: ProgressActivity,
  radio_button_unchecked: RadioButtonUnchecked,
  redo: Redo,
  refresh: Refresh,
  restart_alt: RestartAlt,
  rotate_left: RotateLeft,
  rotate_right: RotateRight,
  search: Search,
  star: Star,
  'star-fill': StarFill,
  star_shine: StarShine,
  'star_shine-fill': StarShineFill,
  undo: Undo,
} as const;

export type IconName = keyof typeof icons;
