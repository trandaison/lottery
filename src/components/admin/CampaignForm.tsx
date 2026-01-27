'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trash2, Plus, Info, Gift, CreditCard, Copy, Check, RotateCcw } from 'lucide-react';
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
import type { CampaignWithPrizes } from '@/types';

// Form schema matching backend validation
const campaignFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(255),
    slug: z.string().max(255).optional(),
    description: z.string().optional(),
    startTime: z.date({ message: 'Start time is required' }),
    endTime: z.date({ message: 'End time is required' }),
    ticketPrice: z.number().int().positive('Ticket price must be positive'),
    status: z.enum(['active', 'drawing', 'completed', 'canceled']),
    excludeWinningNumbers: z.boolean(),
    paymentType: z.enum(['direct', 'transfer']),
    bankNameOrCode: z.string().optional(),
    accountNumber: z.string().optional(),
    prizes: z
      .array(
        z.object({
          title: z.string().min(1, 'Prize title is required').max(255),
          prizesCount: z.number().int().positive('Prize count must be positive'),
          matchingDigits: z.number().int().min(1).max(6),
          prizeValue: z.number().int().positive('Prize value must be positive'),
        })
      )
      .min(1, 'At least one prize is required'),
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
  const [copiedWebhookKey, setCopiedWebhookKey] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [webhookJWT, setWebhookJWT] = useState<string | null>(
    campaign?.webhookApiKey || null
  );
  const [isReissuing, setIsReissuing] = useState(false);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: campaign
      ? {
          title: campaign.title,
          slug: campaign.slug || '',
          description: campaign.description || '',
          startTime: new Date(campaign.startTime),
          endTime: new Date(campaign.endTime),
          ticketPrice: campaign.ticketPrice,
          status: campaign.status,
          excludeWinningNumbers: campaign.excludeWinningNumbers,
          paymentType: campaign.paymentType,
          bankNameOrCode: campaign.bankNameOrCode || '',
          accountNumber: campaign.accountNumber || '',
          prizes: campaign.prizes.map((p) => ({
            title: p.title,
            prizesCount: p.prizesCount,
            matchingDigits: p.matchingDigits,
            prizeValue: p.prizeValue,
          })),
        }
      : {
          title: '',
          slug: '',
          description: '',
          startTime: new Date(),
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ticketPrice: 10000,
          status: 'active' as const,
          excludeWinningNumbers: true,
          paymentType: 'direct' as const,
          bankNameOrCode: '',
          accountNumber: '',
          prizes: [
            {
              title: 'Giải nhất',
              prizesCount: 1,
              matchingDigits: 6,
              prizeValue: 1000000,
            },
          ],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'prizes',
  });

  const paymentType = form.watch('paymentType');
  const title = form.watch('title');

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
    console.log('Form submitted with data:', data);
    console.log('Form validation errors:', form.formState.errors);
    try {
      await onSubmit(data);
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
                  <FormLabel>Description (Markdown)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter campaign description (supports Markdown)"
                      rows={6}
                      {...field}
                    />
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
            <FormField
              control={form.control}
              name="excludeWinningNumbers"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
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

            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id}>
                  <CardContent className="px-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Prize #{index + 1}</h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`prizes.${index}.title`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prize Title</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Giải nhất" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`prizes.${index}.prizesCount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Number of Winners</FormLabel>
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

                        <FormField
                          control={form.control}
                          name={`prizes.${index}.matchingDigits`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Matching Digits (1-6)</FormLabel>
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

                        <FormField
                          control={form.control}
                          name={`prizes.${index}.prizeValue`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prize Value (VND)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="1000000"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    title: '',
                    prizesCount: 1,
                    matchingDigits: 3,
                    prizeValue: 100000,
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
