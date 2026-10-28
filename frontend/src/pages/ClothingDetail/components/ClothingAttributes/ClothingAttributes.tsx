import { useState } from 'react';
import Accordion from '@/components/common/Accordion';
import AccordionItem from '@/components/common/AccordionItem';
import Chip from '@/components/common/Chip';
import ChipGroup from '@/components/common/ChipGroup';
import {
  ACCESSORY_TYPE_LABEL,
  ACCESSORY_TYPES,
  CLOTHING_CATEGORIES,
  CLOTHING_CATEGORY_LABEL,
  CLOTHING_COLOR_LABEL,
  CLOTHING_COLORS,
  CLOTHING_SEASON_LABEL,
  CLOTHING_SEASONS,
  CLOTHING_THICKNESS_LABEL,
  CLOTHING_THICKNESSES,
} from '@/constants/clothingAttribute';
import { STYLE_OPTIONS } from '@/domains/member/memberSettingOptions';
import type { ClothingDetail, ClothingUpdate } from '@/generated/models';
import ColorSwatch from '@/pages/ClothingDetail/components/ColorSwatch';
import type { AttributeField } from '@/pages/ClothingDetail/hooks/useClothingAttributeSave';
import * as S from './ClothingAttributes.styled';

interface ClothingAttributesProps {
  clothing: ClothingDetail;
  errors: Partial<Record<AttributeField, string>>;
  onSave: (
    field: AttributeField,
    update: ClothingUpdate,
    failureTitle: string,
  ) => void;
}

const WATERPROOF_OPTIONS = [
  { value: 'true', label: '예' },
  { value: 'false', label: '아니오' },
] as const;

const STYLE_LABEL = new Map(
  STYLE_OPTIONS.map((option) => [option.value, option.label]),
);

const isOneOf = <T extends string>(
  options: readonly T[],
  value: string,
): value is T => options.some((option) => option === value);

const toWaterproofSummary = (isWaterproof: boolean | null) => {
  if (isWaterproof === null) {
    return undefined;
  }

  return isWaterproof ? '예' : '아니오';
};

const ClothingAttributes = (props: ClothingAttributesProps) => {
  const { clothing, errors, onSave } = props;
  const [openField, setOpenField] = useState<string | null>(null);
  const styleLabels = clothing.style_cds.map(
    (style) => STYLE_LABEL.get(style) ?? style,
  );
  const seasonLabels = clothing.season_cds.map(
    (season) => CLOTHING_SEASON_LABEL[season],
  );

  return (
    <Accordion value={openField} onValueChange={setOpenField}>
      <AccordionItem
        value="category_cd"
        label="분류"
        summary={
          clothing.category_cd === null
            ? undefined
            : CLOTHING_CATEGORY_LABEL[clothing.category_cd]
        }
        placeholder="분류를 선택해 주세요"
        errorMessage={errors.category_cd}
      >
        <ChipGroup
          isDeselectable
          value={clothing.category_cd}
          aria-label="분류"
          onChange={(value) => {
            const category =
              value !== null && isOneOf(CLOTHING_CATEGORIES, value)
                ? value
                : null;
            onSave(
              'category_cd',
              { category_cd: category },
              '분류를 저장하지 못했어요',
            );
          }}
        >
          {CLOTHING_CATEGORIES.map((category) => (
            <Chip key={category} value={category}>
              {CLOTHING_CATEGORY_LABEL[category]}
            </Chip>
          ))}
        </ChipGroup>
      </AccordionItem>
      {clothing.category_cd === 'accessories' && (
        <AccordionItem
          value="accessory_type_cd"
          label="종류"
          summary={
            clothing.accessory_type_cd === null
              ? undefined
              : ACCESSORY_TYPE_LABEL[clothing.accessory_type_cd]
          }
          placeholder="종류를 선택해 주세요"
          errorMessage={errors.accessory_type_cd}
        >
          <ChipGroup
            isDeselectable
            value={clothing.accessory_type_cd}
            aria-label="악세서리 종류"
            onChange={(value) => {
              const accessoryType =
                value !== null && isOneOf(ACCESSORY_TYPES, value)
                  ? value
                  : null;
              onSave(
                'accessory_type_cd',
                { accessory_type_cd: accessoryType },
                '종류를 저장하지 못했어요',
              );
            }}
          >
            {ACCESSORY_TYPES.map((accessoryType) => (
              <Chip key={accessoryType} value={accessoryType}>
                {ACCESSORY_TYPE_LABEL[accessoryType]}
              </Chip>
            ))}
          </ChipGroup>
        </AccordionItem>
      )}
      <AccordionItem
        value="color_cd"
        label="색상"
        summary={
          clothing.color_cd === null ? undefined : (
            <S.ColorSummary>
              <ColorSwatch color={clothing.color_cd} />
              <S.SummaryText>
                {CLOTHING_COLOR_LABEL[clothing.color_cd]}
              </S.SummaryText>
            </S.ColorSummary>
          )
        }
        placeholder="색상을 선택해 주세요"
        errorMessage={errors.color_cd}
      >
        <ChipGroup
          isDeselectable
          value={clothing.color_cd}
          aria-label="색상"
          onChange={(value) => {
            const color =
              value !== null && isOneOf(CLOTHING_COLORS, value) ? value : null;
            onSave('color_cd', { color_cd: color }, '색상을 저장하지 못했어요');
          }}
        >
          {CLOTHING_COLORS.map((color) => (
            <Chip
              key={color}
              value={color}
              leading={<ColorSwatch color={color} />}
            >
              {CLOTHING_COLOR_LABEL[color]}
            </Chip>
          ))}
        </ChipGroup>
      </AccordionItem>
      <AccordionItem
        value="style_cds"
        label="스타일"
        summary={styleLabels.length === 0 ? undefined : styleLabels.join(', ')}
        placeholder="스타일을 선택해 주세요"
        errorMessage={errors.style_cds}
      >
        <ChipGroup
          isMultiple
          value={clothing.style_cds}
          aria-label="스타일"
          onChange={(values) => {
            // 누른 순서와 상관없이 칩 순서대로 보낸다.
            const styles = STYLE_OPTIONS.map((option) => option.value).filter(
              (style) => values.includes(style),
            );
            onSave(
              'style_cds',
              { style_cds: styles },
              '스타일을 저장하지 못했어요',
            );
          }}
        >
          {STYLE_OPTIONS.map((option) => (
            <Chip key={option.value} value={option.value}>
              {option.label}
            </Chip>
          ))}
        </ChipGroup>
      </AccordionItem>
      <AccordionItem
        value="season_cds"
        label="계절"
        summary={
          seasonLabels.length === 0 ? undefined : seasonLabels.join(', ')
        }
        placeholder="계절을 선택해 주세요"
        errorMessage={errors.season_cds}
      >
        <ChipGroup
          isMultiple
          value={clothing.season_cds}
          aria-label="계절"
          onChange={(values) => {
            const seasons = CLOTHING_SEASONS.filter((season) =>
              values.includes(season),
            );
            onSave(
              'season_cds',
              { season_cds: seasons },
              '계절을 저장하지 못했어요',
            );
          }}
        >
          {CLOTHING_SEASONS.map((season) => (
            <Chip key={season} value={season}>
              {CLOTHING_SEASON_LABEL[season]}
            </Chip>
          ))}
        </ChipGroup>
      </AccordionItem>
      <AccordionItem
        value="thickness_cd"
        label="두께"
        summary={
          clothing.thickness_cd === null
            ? undefined
            : CLOTHING_THICKNESS_LABEL[clothing.thickness_cd]
        }
        placeholder="두께를 선택해 주세요"
        errorMessage={errors.thickness_cd}
      >
        <ChipGroup
          isDeselectable
          value={clothing.thickness_cd}
          aria-label="두께"
          onChange={(value) => {
            const thickness =
              value !== null && isOneOf(CLOTHING_THICKNESSES, value)
                ? value
                : null;
            onSave(
              'thickness_cd',
              { thickness_cd: thickness },
              '두께를 저장하지 못했어요',
            );
          }}
        >
          {CLOTHING_THICKNESSES.map((thickness) => (
            <Chip key={thickness} value={thickness}>
              {CLOTHING_THICKNESS_LABEL[thickness]}
            </Chip>
          ))}
        </ChipGroup>
      </AccordionItem>
      <AccordionItem
        value="is_waterproof"
        label="방수"
        summary={toWaterproofSummary(clothing.is_waterproof)}
        placeholder="방수 여부를 선택해 주세요"
        errorMessage={errors.is_waterproof}
      >
        <ChipGroup
          isDeselectable
          value={
            clothing.is_waterproof === null
              ? null
              : String(clothing.is_waterproof)
          }
          aria-label="방수"
          onChange={(value) => {
            onSave(
              'is_waterproof',
              { is_waterproof: value === null ? null : value === 'true' },
              '방수 여부를 저장하지 못했어요',
            );
          }}
        >
          {WATERPROOF_OPTIONS.map((option) => (
            <Chip key={option.value} value={option.value}>
              {option.label}
            </Chip>
          ))}
        </ChipGroup>
      </AccordionItem>
    </Accordion>
  );
};

export default ClothingAttributes;
