import SkeletonText from '@/components/common/SkeletonText';
import { typography } from '@/styles/tokens';
import * as SummaryS from '../SettingSummary/SettingSummary.styled';
import * as S from './SettingSummarySkeleton.styled';

const SINGLE_LINE_VALUE_WIDTHS = ['34%', '28%', '16%'];
const STYLE_TAG_WIDTHS = ['50px', '52px', '46px'];

const SettingSummarySkeleton = () => (
  <S.Container>
    {SINGLE_LINE_VALUE_WIDTHS.map((valueWidth, index) => (
      <SummaryS.Row key={index}>
        <SummaryS.Label as="div">
          <SkeletonText textStyle={typography.body3} width="56%" />
        </SummaryS.Label>
        <SummaryS.Value as="div">
          <SkeletonText textStyle={typography.body2} width={valueWidth} />
        </SummaryS.Value>
      </SummaryS.Row>
    ))}
    <SummaryS.Row $isTopAligned>
      <SummaryS.Label as="div">
        <SkeletonText textStyle={typography.body3} width="76%" />
      </SummaryS.Label>
      <SummaryS.Tags as="div">
        {STYLE_TAG_WIDTHS.map((width) => (
          <S.Tag key={width} tone="soft" $width={width} />
        ))}
      </SummaryS.Tags>
    </SummaryS.Row>
  </S.Container>
);

export default SettingSummarySkeleton;
