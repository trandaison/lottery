'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import ReactMarkdown from 'react-markdown';
import { Trash2, Plus, Info, Gift, CreditCard, Copy, Check, RotateCcw, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CampaignWithPrizes, CampaignPrizeDTO } from '@/types';

// Form schema matching backend validation (prizeValueType at campaign level)
const campaignFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(255),
    slug: z.string().max(255).optional(),
    description: z.string().optional(),
    startTime: z.date({ message: 'Start time is required' }),
    endTime: z.date({ message: 'End time is required' }),
    ticketPrice: z.number().int().positive('Ticket price must be positive'),
    minimumTickets: z.number().int().min(1).default(1),
    status: z.enum(['active', 'drawing', 'completed', 'canceled']),
    excludeWinningNumbers: z.boolean(),
    paymentType: z.enum(['direct', 'transfer']),
    bankNameOrCode: z.string().optional(),
    accountNumber: z.string().optional(),
    prizeValueType: z.enum(['fixed', 'percent']),
    prizes: z
      .array(
        z.object({
          _uid: z.string().optional(),
          title: z.string().min(1, 'Prize title is required').max(255),
          prizesCount: z.number().int().positive('Prize count must be positive'),
          matchingDigits: z.number().int().min(1).max(6),
          prizeValue: z.string().max(255),
          prizeValuePercent: z.number().int().min(0).max(100).optional().nullable(),
          displayOrder: z.number().int().min(0),
        })
      )
      .min(1, 'At least one prize is required'),
  })
  .superRefine((data, ctx) => {
    const type = data.prizeValueType;
    data.prizes.forEach((p, i) => {
      if (type === 'fixed' && (!p.prizeValue || p.prizeValue.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Prize value is required when campaign type is fixed',
          path: ['prizes', i, 'prizeValue'],
        });
      }
      if (type === 'percent') {
        if (p.prizeValuePercent == null || p.prizeValuePercent < 0 || p.prizeValuePercent > 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Percent (0-100) is required when campaign type is percent',
            path: ['prizes', i, 'prizeValuePercent'],
          });
        }
      }
    });
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
  .refine(
    (data) => {
      if (data.paymentType === 'transfer') {
        return data.bankNameOrCode && data.accountNumber;
      }
      return true;
    },
    {
      message: 'Bank information is required for transfer payment type',
      path: ['paymentType'],
    }
  );

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

interface SortablePrizeCardProps {
  id: string;
  index: number;
  form: ReturnType<typeof useForm<CampaignFormValues>>;
  onRemove: () => void;
  canRemove: boolean;
}

function SortablePrizeCard({ id, index, form, onRemove, canRemove }: SortablePrizeCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? 'opacity-60 p-0!' : 'p-0!'}>
      <CardContent className="px-4 py-3 flex gap-4">
        <div
          className="flex items-center cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-5">
            <FormField
              control={form.control}
              name={`prizes.${index}.title`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Prize Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Giải nhất" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="col-span-2">
            <FormField
              control={form.control}
              name={`prizes.${index}.prizesCount`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Winners</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="col-span-2">
            <FormField
              control={form.control}
              name={`prizes.${index}.matchingDigits`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Digits</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={6}
                      placeholder="6"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="col-span-3 flex items-end gap-1 flex-wrap">
            {form.watch('prizeValueType') === 'percent' ? (
              <FormField
                control={form.control}
                name={`prizes.${index}.prizeValuePercent`}
                render={({ field }) => (
                  <FormItem className="flex-1 min-w-[80px]">
                    <FormLabel className="text-xs">% doanh thu</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="10"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name={`prizes.${index}.prizeValue`}
                render={({ field }) => (
                  <FormItem className="flex-1 min-w-[100px]">
                    <FormLabel className="text-xs">Value (VND hoặc text)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="1000000 hoặc 1 iPhone"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {canRemove && (
              <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="shrink-0 mb-1">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CampaignFormProps {
  campaign?: CampaignWithPrizes;
  onSubmit: (data: CampaignFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  mode: 'create' | 'edit';
}

export function CampaignForm({
  campaign,
  onSubmit,
  onCancel,
  isLoading = false,
  mode,
}: CampaignFormProps) {
  const [autoSlug, setAutoSlug] = useState(true);
  const [descriptionPreviewMode, setDescriptionPreviewMode] = useState(false);
  const [copiedWebhookKey, setCopiedWebhookKey] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [webhookJWT, setWebhookJWT] = useState<string | null>(
    campaign?.webhookApiKey || null
  );
  const [isReissuing, setIsReissuing] = useState(false);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema) as Resolver<CampaignFormValues>,
    defaultValues: campaign
      ? {
          title: campaign.title,
          slug: campaign.slug || '',
          description: campaign.description || '',
          startTime: new Date(campaign.startTime),
          endTime: new Date(campaign.endTime),
          ticketPrice: campaign.ticketPrice,
          minimumTickets: campaign.minimumTickets ?? 1,
          status: campaign.status,
          excludeWinningNumbers: campaign.excludeWinningNumbers,
          paymentType: campaign.paymentType,
          bankNameOrCode: campaign.bankNameOrCode || '',
          accountNumber: campaign.accountNumber || '',
          prizeValueType: campaign.prizeValueType ?? 'fixed',
          prizes: campaign.prizes.map((p, index) => ({
            _uid: `prize-${(p as { id?: number }).id ?? index}`,
            title: p.title,
            prizesCount: p.prizesCount,
            matchingDigits: p.matchingDigits,
            prizeValue: typeof p.prizeValue === 'number' ? String(p.prizeValue) : (p.prizeValue ?? ''),
            prizeValuePercent: (p as CampaignPrizeDTO).prizeValuePercent ?? null,
            displayOrder: (p as { displayOrder?: number }).displayOrder ?? index,
          })),
        }
      : {
          title: '',
          slug: '',
          description: '',
          startTime: new Date(),
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ticketPrice: 10000,
          minimumTickets: 1,
          status: 'active' as const,
          excludeWinningNumbers: true,
          paymentType: 'direct' as const,
          bankNameOrCode: '',
          accountNumber: '',
          prizeValueType: 'fixed',
          prizes: [
            {
              _uid: `prize-${Date.now()}-0`,
              title: 'Giải nhất',
              prizesCount: 1,
              matchingDigits: 6,
              prizeValue: '1000000',
              prizeValuePercent: null,
              displayOrder: 0,
            },
          ],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'prizes',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const prizes = form.getValues('prizes');
      const oldIndex = prizes.findIndex((p) => p._uid === active.id);
      const newIndex = prizes.findIndex((p) => p._uid === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove([...prizes], oldIndex, newIndex);
        reordered.forEach((p, i) => {
          p.displayOrder = i;
        });
        form.setValue('prizes', reordered);
      }
    }
  };

  const paymentType = form.watch('paymentType');
  const title = form.watch('title');
  const prizesSnapshot = form.watch('prizes') as Array<{ _uid?: string }>;

  // Initialize webhook JWT from campaign prop
  useEffect(() => {
    if (campaign?.webhookApiKey) {
      setWebhookJWT(campaign.webhookApiKey);
    } else if (campaign?.id && campaign?.paymentType === 'transfer') {
      // Fetch if missing
      const fetchWebhookJWT = async () => {
        try {
          const response = await fetch(
            `/api/v1/admin/campaigns/${campaign.id}/webhook-jwt`
          );
          const result = await response.json();

          if (result?.success && result.data.token) {
            setWebhookJWT(result.data.token);
          }
        } catch (error) {
          console.error('Failed to fetch webhook JWT:', error);
        }
      };

      fetchWebhookJWT();
    }
  }, [campaign?.id, campaign?.webhookApiKey, campaign?.paymentType]);

  // Copy webhook key to clipboard
  const copyWebhookKey = async () => {
    if (webhookJWT) {
      await navigator.clipboard.writeText(webhookJWT);
      setCopiedWebhookKey(true);
      setTimeout(() => setCopiedWebhookKey(false), 2000);
    }
  };

  // Copy webhook URL to clipboard
  const copyWebhookUrl = async () => {
    const webhookUrl = `${window.location.origin}/api/v1/webhooks/sepay`;
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhookUrl(true);
    setTimeout(() => setCopiedWebhookUrl(false), 2000);
  };

  // Reissue webhook JWT
  const handleReissue = async () => {
    if (!campaign?.id) return;

    setIsReissuing(true);
    try {
      const response = await fetch(
        `/api/v1/admin/campaigns/${campaign.id}/webhook-jwt`,
        {
          method: 'POST',
        }
      );
      const result = await response.json();

      if (result?.success && result.data.token) {
        setWebhookJWT(result.data.token);
      } else {
        console.error('Failed to reissue webhook JWT:', result);
      }
    } catch (error) {
      console.error('Error reissuing webhook JWT:', error);
    } finally {
      setIsReissuing(false);
    }
  };

  // Get webhook URL
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/v1/webhooks/sepay`
    : '';

  // Auto-generate slug from title
  useEffect(() => {
    if (autoSlug && title && mode === 'create') {
      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      form.setValue('slug', slug);
    }
  }, [title, autoSlug, form, mode]);

  const handleSubmit = async (data: CampaignFormValues) => {
    const { prizes, prizeValueType, ...rest } = data;
    const prizesForApi = prizes.map(({ _uid, ...p }) => ({
      ...p,
      prizeValue: prizeValueType === 'percent' ? '' : (p.prizeValue ?? ''),
    }));
    try {
      await onSubmit({ ...rest, prizeValueType, prizes: prizesForApi });
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-12">
        {/* Section 1: Campaign Info */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-l-4 border-blue-500 pl-4">
            <Info className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-semibold">Campaign Information</h2>
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter campaign title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (URL)</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        placeholder="campaign-slug"
                        {...field}
                        disabled={autoSlug && mode === 'create'}
                      />
                      {mode === 'create' && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAutoSlug(!autoSlug)}
                        >
                          {autoSlug ? 'Edit' : 'Auto'}
                        </Button>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    URL-friendly version of the title. Auto-generated by default.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Description</FormLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-1.5 py-0 text-muted-foreground hover:text-foreground font-normal"
                      onClick={() => setDescriptionPreviewMode((prev) => !prev)}
                    >
                      {descriptionPreviewMode ? 'Edit' : 'Preview'}
                    </Button>
                  </div>
                  <FormControl>
                    {descriptionPreviewMode ? (
                      <div className="whitespace-pre-line min-h-[26rem] rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {field.value ? (
                            <ReactMarkdown>{field.value}</ReactMarkdown>
                          ) : (
                            <p className="text-muted-foreground italic">No content to preview.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Textarea
                        placeholder="Enter campaign description (supports Markdown)"
                        rows={26}
                        {...field}
                      />
                    )}
                  </FormControl>
                  <FormDescription>You can use Markdown syntax for formatting</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date & Time</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        date={field.value}
                        setDate={(date) => field.onChange(date)}
                        placeholder="Pick start date and time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date & Time</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        date={field.value}
                        setDate={(date) => field.onChange(date)}
                        placeholder="Pick end date and time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="ticketPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket Price (VND)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="10000"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minimumTickets"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Tickets</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="drawing">Drawing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Prizes Settings */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-l-4 border-purple-500 pl-4">
            <Gift className="h-5 w-5 text-purple-500" />
            <h2 className="text-xl font-semibold">Prizes Settings</h2>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <FormField
                control={form.control}
                name="prizeValueType"
                render={({ field }) => (
                  <FormItem className="inline-flex gap-16 flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Giá trị giải thưởng</FormLabel>
                      <FormDescription>
                        Cố định: nhập số tiền hoặc text. Theo % doanh thu: nhập % (0-100) cho mỗi giải.
                      </FormDescription>
                    </div>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">Cố định (số hoặc text)</SelectItem>
                        <SelectItem value="percent">Theo % doanh thu</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="excludeWinningNumbers"
                render={({ field }) => (
                  <FormItem className="inline-flex gap-16 flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Exclude Winning Numbers</FormLabel>
                      <FormDescription>
                        Prevent numbers that have already won from winning again
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={prizesSnapshot.map((p, i) => p._uid ?? `fallback-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {fields.map((field, index) => {
                    const uid = prizesSnapshot[index]?._uid ?? field.id;
                    return (
                      <SortablePrizeCard
                        key={uid}
                        id={uid}
                        index={index}
                        form={form}
                        onRemove={() => remove(index)}
                        canRemove={fields.length > 1}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    _uid: `prize-${Date.now()}-${fields.length}`,
                    title: '',
                    prizesCount: 1,
                    matchingDigits: 6,
                    prizeValue: '',
                    prizeValuePercent: null,
                    displayOrder: fields.length,
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Prize
              </Button>
            </div>
          </div>
        </div>

        {/* Section 3: Payment Settings */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-l-4 border-green-500 pl-4">
            <CreditCard className="h-5 w-5 text-green-500" />
            <h2 className="text-xl font-semibold">Payment Settings</h2>
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="paymentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="direct">Direct (Immediate)</SelectItem>
                      <SelectItem value="transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Direct: Tickets created immediately. Transfer: Requires bank payment.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {paymentType === 'transfer' && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="bankNameOrCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name or Code</FormLabel>
                        <FormControl>
                          <Input placeholder="VCB, Vietcombank, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Display webhook configuration for existing campaigns with transfer payment */}
                {mode === 'edit' && paymentType === 'transfer' && (
                  <>
                    {/* Webhook URL */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <FormLabel className="text-sm font-medium">
                        Webhook URL
                      </FormLabel>
                      <FormDescription className="mt-1 mb-2 text-xs">
                        Configure this URL in SePay webhook settings.
                      </FormDescription>
                      <div className="flex gap-2">
                        <Input
                          value={webhookUrl}
                          readOnly
                          className="font-mono text-xs bg-white"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={copyWebhookUrl}
                          className="shrink-0"
                        >
                          {copiedWebhookUrl ? (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-1" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Webhook API Key */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <FormLabel className="text-sm font-medium">
                        SePay Webhook API Key
                      </FormLabel>
                      <FormDescription className="mt-1 mb-2 text-xs">
                        Use this JWT token in SePay webhook configuration.
                        Copy and paste it into the SePay dashboard as the API key.
                      </FormDescription>
                      <div className="flex gap-2">
                        <Input
                          value={webhookJWT || ''}
                          readOnly
                          className="font-mono text-xs bg-white"
                          placeholder="Will be generated after campaign creation"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleReissue}
                          disabled={isReissuing || !campaign?.id}
                          className="shrink-0"
                        >
                          <RotateCcw className={`h-4 w-4 mr-1 ${isReissuing ? 'animate-spin' : ''}`} />
                          {isReissuing ? 'Reissuing...' : 'Reissue'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={copyWebhookKey}
                          disabled={!webhookJWT}
                          className="shrink-0"
                        >
                          {copiedWebhookKey ? (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-1" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t sticky bottom-0 bg-white -mx-6 -mb-8 px-6 pb-8">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : mode === 'create' ? 'Create Campaign' : 'Update Campaign'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
