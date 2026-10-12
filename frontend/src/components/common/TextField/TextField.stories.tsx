import type { Meta, StoryObj } from '@storybook/react-vite';
import { ICON_NAMES } from '../../../../.storybook/storyIconNames';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import TextField from './TextField';

const meta = {
  component: TextField,
  argTypes: {
    value: {
      description:
        '입력값입니다. 제어형이라 바뀐 값은 `onChange`로 받아 다시 넘겨야 합니다.',
      control: 'text',
    },
    onChange: {
      description:
        '입력값이 바뀔 때 호출합니다. 이벤트 객체가 아니라 바뀐 뒤의 문자열을 넘깁니다.',
    },
    placeholder: {
      description: '값이 비어 있을 때 보이는 안내 문구입니다.',
      control: 'text',
    },
    icon: {
      description: '입력창 앞에 붙는 장식용 아이콘입니다.',
      control: 'select',
      options: ICON_NAMES,
    },
    hasClearButton: {
      description:
        '값을 지우는 버튼을 오른쪽에 둡니다. 값이 있고 비활성이 아닐 때만 보이며, 누르면 값을 비우고 입력창에 포커스를 남깁니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    onClear: {
      description:
        '지우기 버튼을 눌렀을 때 `onChange("")` 다음에 호출합니다. 값 비우기 외에 할 일이 있을 때만 넘깁니다.',
    },
    maxLength: {
      description:
        '글자 수 카운터의 최대값입니다. 넘겨야 카운터가 보입니다. 입력을 막지 않으며, 넘치면 카운터만 에러 색으로 바뀝니다. 글자 수는 코드 포인트 기준으로 셉니다.',
      control: 'number',
    },
    errorMessage: {
      description:
        '에러 문구입니다. 있으면 테두리와 문구가 에러 색으로 바뀌고 입력창이 `aria-invalid`가 됩니다.',
      control: 'text',
    },
    isDisabled: {
      description: '입력을 막고 흐리게 표시합니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    isReadOnly: {
      description:
        '값을 고칠 수 없게 합니다. 비활성과 달리 흐리게 보이지 않고 포커스와 복사는 됩니다. 지우기 버튼은 보이지 않습니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    isRequired: {
      description:
        '필수 입력 여부입니다. 네이티브 `required` 속성으로 걸려 스크린리더에 필수로 읽히고, form 안에서 제출하면 브라우저 기본 검증도 동작합니다.',
      control: 'boolean',
      table: { defaultValue: { summary: 'false' } },
    },
    type: {
      description:
        '네이티브 `type`입니다. search는 스크린리더에 검색창으로 읽히고, tel·email·url은 모바일에서 맞는 키보드를 띄웁니다. 브라우저가 search에 붙이는 기본 지우기 버튼은 숨기므로 `hasClearButton`을 씁니다.',
      control: 'select',
      options: ['text', 'search', 'tel', 'email', 'url'],
      table: { defaultValue: { summary: 'text' } },
    },
    onBlur: {
      description:
        '입력창에서 포커스가 빠질 때 포커스 이벤트를 받아 호출합니다.',
    },
    onFocus: {
      description:
        '입력창에 포커스가 들어올 때 포커스 이벤트를 받아 호출합니다.',
    },
    onKeyDown: {
      description:
        '입력창에서 키를 누를 때 키보드 이벤트를 받아 호출합니다. Enter로 검색이나 제출을 처리할 때는 `event.nativeEvent.isComposing`이 true인 동안 무시해야 한글 마지막 글자가 중복되지 않습니다.',
    },
    ref: {
      description: '안쪽 `input` 요소에 연결할 ref입니다.',
      control: false,
    },
    id: {
      description:
        '안쪽 `input`의 id입니다. `FormField`의 `htmlFor`와 맞추면 라벨을 눌렀을 때 입력창에 포커스가 갑니다. 스크린리더용 이름 연결은 `FormField` 안에 두기만 해도 됩니다.',
      control: 'text',
    },
    name: {
      description: '안쪽 `input`의 name입니다.',
      control: 'text',
    },
    inputMode: {
      description: '모바일에서 띄울 가상 키보드의 종류입니다.',
      control: 'select',
      options: [
        'none',
        'text',
        'tel',
        'url',
        'email',
        'numeric',
        'decimal',
        'search',
      ],
    },
    enterKeyHint: {
      description: '모바일 가상 키보드의 엔터 키에 표시할 동작입니다.',
      control: 'select',
      options: ['enter', 'done', 'go', 'next', 'previous', 'search', 'send'],
    },
    autoComplete: {
      description: '브라우저 자동 완성 힌트입니다.',
      control: 'text',
    },
    autoFocus: {
      description: '처음 그려질 때 입력창에 포커스를 줍니다.',
      control: 'boolean',
    },
    'aria-label': {
      description:
        '보이는 라벨이 없을 때 스크린리더가 읽을 이름입니다. `FormField` 안에서는 라벨이 자동으로 이름이 되므로 비워 둡니다. 넘기면 `FormField` 라벨 대신 이 값을 읽습니다.',
      control: 'text',
    },
    'aria-labelledby': {
      description:
        '보이는 다른 요소를 이름으로 쓸 때 그 요소의 id입니다. 여러 개면 공백으로 구분합니다. `FormField` 안에서 넘기지 않으면 `FormField` 라벨의 id가 들어갑니다.',
      control: 'text',
    },
    'aria-describedby': {
      description:
        '입력창의 설명으로 읽힐 요소의 id입니다. `FormField`의 안내 문구, 에러 문구, 글자 수 카운터는 자동으로 이어 붙으므로 그 밖의 설명만 넘깁니다.',
      control: 'text',
    },
  },
  args: {
    value: '',
    onChange: fn(),
    onClear: fn(),
    onBlur: fn(),
    onFocus: fn(),
    onKeyDown: fn(),
    placeholder: '입력해 주세요',
    'aria-label': '입력',
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs();

    const handleChange = (value: string) => {
      args.onChange(value);
      updateArgs({ value });
    };

    return <TextField {...args} onChange={handleChange} />;
  },
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: {
    value: '입력한 값',
  },
};

export const WithIcon: Story = {
  args: {
    icon: 'search',
  },
};

export const WithClearButton: Story = {
  args: {
    value: '지울 수 있는 값',
    hasClearButton: true,
  },
};

export const WithCounter: Story = {
  args: {
    value: '글자 수',
    maxLength: 20,
  },
};

export const CounterOverflow: Story = {
  args: {
    value: '최대 글자 수를 넘긴 입력값입니다',
    maxLength: 10,
  },
};

export const WithError: Story = {
  args: {
    value: '잘못된 값',
    errorMessage: '다시 확인해 주세요.',
  },
};

export const Disabled: Story = {
  args: {
    value: '바꿀 수 없는 값',
    icon: 'search',
    hasClearButton: true,
    isDisabled: true,
  },
};

export const ReadOnly: Story = {
  args: {
    value: '고칠 수 없는 값',
    icon: 'search',
    hasClearButton: true,
    isReadOnly: true,
  },
};

export const LongText: Story = {
  args: {
    value:
      '입력창 너비보다 훨씬 긴 문장을 넣어도 글자가 아이콘이나 카운터와 겹치지 않아야 합니다',
    icon: 'search',
    hasClearButton: true,
    maxLength: 100,
    errorMessage:
      '에러 문구도 길어지면 입력창 너비 안에서 줄을 바꿔 끝까지 보여 줍니다. 문구가 잘리지 않는지 확인합니다.',
  },
};

export const AddressSearch: Story = {
  args: {
    value: '성동',
    icon: 'search',
    hasClearButton: true,
    placeholder: '시·구 이름으로 검색',
    type: 'search',
    enterKeyHint: 'search',
    'aria-label': '주소 검색',
  },
};

export const SituationInput: Story = {
  args: {
    value: '학교 발표',
    maxLength: 100,
    placeholder: '예: 학교 발표',
    enterKeyHint: 'done',
    'aria-label': '상황',
  },
};
