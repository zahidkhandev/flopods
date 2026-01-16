import { memo, useState, useCallback } from 'react';
import { NodeProps } from 'reactflow';
import BasePodNode from './base-pod-node';
import { Upload, Type, FileText, Link, Image, Video, Music, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PodExecutionStatus } from '../../types';
import { useCanvas } from '../../context/canvas-context';

interface SourcePodData {
  label: string;
  config: {
    sourceType: 'text' | 'document' | 'url' | 'video' | 'audio' | 'image' | 'youtube';
    content: string;
  };
  executionStatus: PodExecutionStatus;
}

const sourceTypeIcons = {
  text: Type,
  document: FileText,
  url: Link,
  image: Image,
  video: Video,
  audio: Music,
  youtube: Youtube,
};

export default memo(function SourcePodNode({
  id: nodeId,
  data,
  selected,
}: NodeProps<SourcePodData>) {
  const [sourceType, setSourceType] = useState(data.config.sourceType);
  const { updateNodeData } = useCanvas();
  const SourceIcon = sourceTypeIcons[sourceType];

  const handleSourceTypeChange = useCallback(
    (value: any) => {
      setSourceType(value);
      updateNodeData(nodeId, {
        config: { ...data.config, sourceType: value },
      });
    },
    [nodeId, data.config, updateNodeData]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      updateNodeData(nodeId, {
        config: { ...data.config, content },
      });
    },
    [nodeId, data.config, updateNodeData]
  );

  return (
    <BasePodNode
      id={nodeId} // PASSING ID HERE
      title={data.label}
      icon={<Upload className="h-5 w-5" />}
      status={data.executionStatus}
      variant="input"
      selected={selected}
    >
      <Select value={sourceType} onValueChange={handleSourceTypeChange}>
        <SelectTrigger className="nodrag nowheel w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="nodrag nowheel">
          <SelectItem value="text">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Text
            </div>
          </SelectItem>
          <SelectItem value="document">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document
            </div>
          </SelectItem>
          <SelectItem value="url">
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              URL
            </div>
          </SelectItem>
          <SelectItem value="youtube">
            <div className="flex items-center gap-2">
              <Youtube className="h-4 w-4" />
              YouTube
            </div>
          </SelectItem>
          <SelectItem value="image">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Image
            </div>
          </SelectItem>
          <SelectItem value="video">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Video
            </div>
          </SelectItem>
          <SelectItem value="audio">
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              Audio
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {sourceType === 'text' && (
        <Textarea
          placeholder="Enter your text here..."
          className="nodrag nowheel min-h-25"
          defaultValue={data.config.content}
          onChange={(e) => handleContentChange(e.target.value)}
        />
      )}

      {['document', 'image', 'video', 'audio'].includes(sourceType) && (
        <div className="bg-muted/30 border-border/50 rounded-lg border border-dashed p-6 text-center">
          <SourceIcon className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground mb-2 text-xs">No {sourceType} uploaded</p>
          <Button
            size="sm"
            variant="outline"
            className="nodrag h-7 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            Upload {sourceType.charAt(0).toUpperCase() + sourceType.slice(1)}
          </Button>
        </div>
      )}

      {['url', 'youtube'].includes(sourceType) && (
        <input
          type="url"
          placeholder={`Enter ${sourceType === 'youtube' ? 'YouTube' : ''} URL...`}
          className="nodrag nowheel border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          defaultValue={data.config.content}
          onChange={(e) => handleContentChange(e.target.value)}
        />
      )}
    </BasePodNode>
  );
});
