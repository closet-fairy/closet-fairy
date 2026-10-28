import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import ClothingNameField from './ClothingNameField';

// 390px 화면에서 좌우 여백을 뺀 폭이다.
const FIELD_WIDTH = 350;

const meta = {
  component: ClothingNameField,
  argTypes: {
    name: {
      description:
        '서버에 저장된 옷 이름입니다. 비어 있으면 `null`이고, 입력칸의 처음 값으로만 씁니다.',
      control: 'text',
    },
    errorMessage: {
      description:
        '이름을 저장하지 못했을 때 입력칸 아래에 보여 줄 서버 문구입니다.',
      control: 'text',
    },
    onSave: {
      description:
        '입력칸을 벗어나거나 키보드의 완료를 눌렀을 때, 이름이 바뀌었으면 앞뒤 공백을 뺀 이름으로 호출합니다. 비우면 `null`입니다.',
    },
  },
  args: {
    name: '베이지 터틀넥',
    onSave: fn(),
  },
  render: (args) => (
    <div style={{ width: FIELD_WIDTH }}>
      <ClothingNameField {...args} />
    </div>
  ),
} satisfies Meta<typeof ClothingNameField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { name: null },
};

export const SaveFailed: Story = {
  args: { errorMessage: '서버에 연결할 수 없습니다.' },
};
