import { Label } from '../ui/label';

const PILL_COLORS = [
  { name: 'Indigo', value: '#4F46E5' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Gray', value: '#6B7280' },
];

const PILL_SHAPES = [
  { name: 'Round', value: 'round', style: 'rounded-full aspect-square' },
  { name: 'Oval', value: 'oval', style: 'rounded-full aspect-[1.8] w-14' },
  { name: 'Capsule', value: 'capsule', style: 'rounded-full aspect-[2.5] w-16' },
  { name: 'Square', value: 'square', style: 'rounded-md aspect-square' },
];

export const PillSelector = ({ selectedColor, selectedShape, onColorChange, onShapeChange }) => {
  return (
    <div className="space-y-6">
      {/* Color Selection */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Pill Color</Label>
        <div className="flex flex-wrap gap-3">
          {PILL_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => onColorChange(color.value)}
              className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${
                selectedColor === color.value 
                  ? 'ring-2 ring-primary ring-offset-2 border-primary' 
                  : 'border-border hover:border-primary/50'
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
              data-testid={`pill-color-${color.name.toLowerCase()}`}
            />
          ))}
        </div>
      </div>

      {/* Shape Selection */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Pill Shape</Label>
        <div className="flex flex-wrap gap-4">
          {PILL_SHAPES.map((shape) => (
            <button
              key={shape.value}
              type="button"
              onClick={() => onShapeChange(shape.value)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:border-primary/50 ${
                selectedShape === shape.value 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border'
              }`}
              data-testid={`pill-shape-${shape.value}`}
            >
              <div 
                className={`h-8 ${shape.style} flex items-center justify-center`}
                style={{ 
                  backgroundColor: selectedColor,
                  width: shape.value === 'round' || shape.value === 'square' ? '32px' : undefined 
                }}
              />
              <span className="text-xs font-medium">{shape.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-muted/50 rounded-xl p-6">
        <Label className="text-sm text-muted-foreground mb-3 block">Preview</Label>
        <div className="flex items-center justify-center">
          <div 
            className={`w-20 h-20 flex items-center justify-center shadow-lg ${
              selectedShape === 'round' ? 'rounded-full' :
              selectedShape === 'oval' ? 'rounded-full aspect-[1.5] w-28 h-16' :
              selectedShape === 'capsule' ? 'rounded-full aspect-[2.5] w-32 h-14' :
              'rounded-lg'
            }`}
            style={{ backgroundColor: selectedColor }}
          >
            <span className="text-white text-xl font-bold opacity-60">Rx</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PillSelector;
