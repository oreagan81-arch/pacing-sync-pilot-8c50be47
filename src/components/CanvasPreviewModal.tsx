import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Rocket, Loader2 } from 'lucide-react';

interface CanvasPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (editedContent: string | object) => void;
  title: string;
  description: string;
  generatedHtml?: string;
  payload?: object;
  isDeploying: boolean;
}

export function CanvasPreviewModal({
  isOpen,
  onClose,
  onDeploy,
  title,
  description,
  generatedHtml,
  payload,
  isDeploying,
}: CanvasPreviewModalProps) {
  const isHtmlContent = generatedHtml !== undefined;
  const initialContent = isHtmlContent ? generatedHtml : JSON.stringify(payload, null, 2);
  const [editedContent, setEditedContent] = useState(initialContent);

  useEffect(() => {
    setEditedContent(initialContent);
  }, [initialContent]);

  const handleDeploy = () => {
    try {
      const contentToDeploy = isHtmlContent ? editedContent : JSON.parse(editedContent);
      onDeploy(contentToDeploy);
    } catch (e) {
      console.error("Error parsing edited JSON payload:", e);
      // Here you might want to show a toast notification to the user
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col bg-slate-900/80 backdrop-blur-sm border-slate-800">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex-grow min-h-0">
          <Tabs defaultValue="preview" className="flex flex-col h-full">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="edit">
                {isHtmlContent ? 'Edit HTML' : 'Edit Payload'}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="flex-grow mt-2 overflow-auto bg-slate-950/50 rounded-md p-4 border border-slate-800">
              {isHtmlContent ? (
                <div
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: editedContent }}
                />
              ) : (
                <pre className="text-sm text-slate-300 overflow-x-auto">
                  <code>{JSON.stringify(JSON.parse(editedContent || '{}'), null, 2)}</code>
                </pre>
              )}
            </TabsContent>
            <TabsContent value="edit" className="flex-grow mt-2">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="h-full resize-none font-mono bg-slate-950/50 border-slate-800"
                placeholder={
                  isHtmlContent
                    ? 'Edit the generated HTML...'
                    : 'Edit the JSON payload...'
                }
              />
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isDeploying}>
            Cancel
          </Button>
          <Button onClick={handleDeploy} disabled={isDeploying} className="gap-2">
            {isDeploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {isDeploying ? 'Deploying...' : 'Deploy to Canvas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
