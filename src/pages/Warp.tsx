import { useEffect, useState } from 'react'
import {
    AlertCircle,
    Globe,
    Globe2,
    Link2,
    Loader2,
    Play,
    Plus,
    RefreshCw,
    Shield,
    Square,
    Trash2,
    Unplug,
} from 'lucide-react'
import { toast } from 'sonner'
import { accountsApi, warpApi } from '../api/client'
import type {
    AccountResponse,
    WarpEndpointMode,
    WarpInstanceResponse,
    WarpRegisterMode,
    WarpRegisterRequest,
} from '../api/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

function formatDate(value?: string | null) {
    if (!value) {
        return '-'
    }

    return new Date(value).toLocaleString('zh-CN')
}

function shortId(value: string) {
    return `${value.slice(0, 8)}...`
}

function parseEndpointInput(value: string): string[] {
    return value
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .flatMap(part => part.split(','))
        .map(part => part.trim())
        .filter(Boolean)
}

function describeEndpointMode(instance: WarpInstanceResponse) {
    switch (instance.endpoint_mode) {
        case 'scan':
            return '扫描最优 endpoint'
        case 'custom':
            return `自定义 endpoint 列表（${instance.custom_endpoints.length} 个）`
        default:
            return '自动'
    }
}

function getStatusBadge(status: WarpInstanceResponse['status']) {
    switch (status) {
        case 'running':
            return (
                <Badge variant='default' className='bg-green-500'>
                    运行中
                </Badge>
            )
        case 'starting':
            return <Badge variant='secondary'>启动中</Badge>
        case 'stopped':
            return <Badge variant='outline'>已停止</Badge>
        case 'error':
            return <Badge variant='destructive'>异常</Badge>
        default:
            return <Badge variant='outline'>{status}</Badge>
    }
}

const registerProxyModeStorageKey = 'warpRegisterProxyMode'
const registerProxyUrlStorageKey = 'warpRegisterProxyUrl'
const endpointModeStorageKey = 'warpEndpointMode'
const customEndpointsStorageKey = 'warpCustomEndpoints'

function isWarpRegisterMode(value: string | null): value is WarpRegisterMode {
    return value === 'default' || value === 'direct' || value === 'custom'
}

function isWarpEndpointMode(value: string | null): value is WarpEndpointMode {
    return value === 'default' || value === 'auto' || value === 'scan' || value === 'custom'
}

export function Warp() {
    const [instances, setInstances] = useState<WarpInstanceResponse[]>([])
    const [accounts, setAccounts] = useState<AccountResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [creating, setCreating] = useState(false)
    const [pendingActions, setPendingActions] = useState<Set<string>>(new Set())
    const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({})
    const [registerProxyMode, setRegisterProxyMode] = useState<WarpRegisterMode>('default')
    const [registerProxyUrl, setRegisterProxyUrl] = useState('')
    const [endpointMode, setEndpointMode] = useState<WarpEndpointMode>('default')
    const [customEndpointsText, setCustomEndpointsText] = useState('')

    const loadData = async (showRefreshing = false) => {
        if (showRefreshing) {
            setRefreshing(true)
        }

        try {
            const [instancesResponse, accountsResponse] = await Promise.all([warpApi.list(), accountsApi.list()])
            setInstances(instancesResponse.data)
            setAccounts(accountsResponse.data)
        } catch (error) {
            console.error('Failed to load WARP data:', error)
        } finally {
            setLoading(false)
            if (showRefreshing) {
                setRefreshing(false)
            }
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        const savedMode = localStorage.getItem(registerProxyModeStorageKey)
        const savedProxyUrl = localStorage.getItem(registerProxyUrlStorageKey)
        const savedEndpointMode = localStorage.getItem(endpointModeStorageKey)
        const savedCustomEndpoints = localStorage.getItem(customEndpointsStorageKey)

        if (isWarpRegisterMode(savedMode)) {
            setRegisterProxyMode(savedMode)
        }
        if (savedProxyUrl) {
            setRegisterProxyUrl(savedProxyUrl)
        }
        if (isWarpEndpointMode(savedEndpointMode)) {
            setEndpointMode(savedEndpointMode)
        }
        if (savedCustomEndpoints) {
            setCustomEndpointsText(savedCustomEndpoints)
        }
    }, [])

    useEffect(() => {
        localStorage.setItem(registerProxyModeStorageKey, registerProxyMode)
    }, [registerProxyMode])

    useEffect(() => {
        localStorage.setItem(registerProxyUrlStorageKey, registerProxyUrl)
    }, [registerProxyUrl])

    useEffect(() => {
        localStorage.setItem(endpointModeStorageKey, endpointMode)
    }, [endpointMode])

    useEffect(() => {
        localStorage.setItem(customEndpointsStorageKey, customEndpointsText)
    }, [customEndpointsText])

    const setActionPending = (key: string, active: boolean) => {
        setPendingActions(prev => {
            const next = new Set(prev)
            if (active) {
                next.add(key)
            } else {
                next.delete(key)
            }
            return next
        })
    }

    const runAction = async (key: string, action: () => Promise<void>) => {
        setActionPending(key, true)
        try {
            await action()
            await loadData()
        } finally {
            setActionPending(key, false)
        }
    }

    const handleRegister = async () => {
        const trimmedRegisterProxyUrl = registerProxyUrl.trim()
        const customEndpoints = parseEndpointInput(customEndpointsText)
        if (registerProxyMode === 'custom' && !trimmedRegisterProxyUrl) {
            toast.error('自定义申请代理模式需要填写代理 URL')
            return
        }
        if (endpointMode === 'custom' && customEndpoints.length === 0) {
            toast.error('自定义 endpoint 模式需要至少填写一个 endpoint')
            return
        }

        setCreating(true)
        try {
            const payload: WarpRegisterRequest = {
                register_proxy_mode: registerProxyMode,
                endpoint_mode: endpointMode,
            }

            if (registerProxyMode === 'custom') {
                payload.register_proxy_url = trimmedRegisterProxyUrl
            }
            if (endpointMode === 'custom') {
                payload.custom_endpoints = customEndpoints
            }

            await warpApi.register(payload)
            toast.success('新的 WARP IP 已创建')
            await loadData()
        } catch (error) {
            console.error('Failed to register WARP instance:', error)
        } finally {
            setCreating(false)
        }
    }

    const runningCount = instances.filter(instance => instance.status === 'running').length
    const availableIpCount = instances.filter(instance => Boolean(instance.public_ipv4 || instance.public_ipv6)).length
    const dualStackCount = instances.filter(instance => Boolean(instance.public_ipv4 && instance.public_ipv6)).length

    if (loading) {
        return (
            <div className='space-y-6'>
                <div className='space-y-2'>
                    <Skeleton className='h-8 w-40' />
                    <Skeleton className='h-4 w-80' />
                </div>
                <div className='grid gap-4 md:grid-cols-4'>
                    {[...Array(4)].map((_, index) => (
                        <Card key={index}>
                            <CardHeader>
                                <Skeleton className='h-5 w-24' />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className='h-8 w-16' />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <div className='grid gap-4 xl:grid-cols-2'>
                    {[...Array(2)].map((_, index) => (
                        <Card key={index}>
                            <CardHeader>
                                <Skeleton className='h-6 w-48' />
                                <Skeleton className='h-4 w-56' />
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                <Skeleton className='h-24 w-full' />
                                <Skeleton className='h-10 w-full' />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className='space-y-6'>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
                <div>
                    <h1 className='text-3xl font-bold tracking-tight pb-1'>WARP IP</h1>
                    <p className='text-muted-foreground'>在 Web 中创建独立的 Cloudflare WARP 出口 IP，并绑定到 Claude 账户。</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <Button variant='outline' onClick={() => loadData(true)} disabled={refreshing}>
                        {refreshing ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                        刷新
                    </Button>
                    <Button onClick={handleRegister} disabled={creating}>
                        {creating ? <Loader2 className='h-4 w-4 animate-spin' /> : <Plus className='h-4 w-4' />}
                        一键创建 IP
                    </Button>
                </div>
            </div>

            <Card className='border-dashed'>
                <CardHeader className='pb-3'>
                    <CardTitle className='text-base'>本次创建策略</CardTitle>
                    <CardDescription>
                        创建新 WARP IP 时可临时切换前置代理和 endpoint 策略。带“默认”的选项会读取设置页中的全局配置，其余模式只对本次创建生效。
                    </CardDescription>
                </CardHeader>
                <CardContent className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                        <Label htmlFor='register-proxy-mode'>申请模式</Label>
                        <Select value={registerProxyMode} onValueChange={value => setRegisterProxyMode(value as WarpRegisterMode)}>
                            <SelectTrigger id='register-proxy-mode'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='default'>使用设置中的默认代理</SelectItem>
                                <SelectItem value='direct'>本次直连申请</SelectItem>
                                <SelectItem value='custom'>本次使用自定义代理</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='register-proxy-url'>本次申请代理 URL</Label>
                        <Input
                            id='register-proxy-url'
                            value={registerProxyUrl}
                            onChange={event => setRegisterProxyUrl(event.target.value)}
                            disabled={registerProxyMode !== 'custom'}
                            placeholder={
                                registerProxyMode === 'custom'
                                    ? '例如 socks5://user:pass@host:port'
                                    : registerProxyMode === 'direct'
                                      ? '本次强制直连，不使用前置代理'
                                      : '留空时使用设置页中的默认申请代理'
                            }
                        />
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='endpoint-mode'>endpoint 策略</Label>
                        <Select value={endpointMode} onValueChange={value => setEndpointMode(value as WarpEndpointMode)}>
                            <SelectTrigger id='endpoint-mode'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='default'>使用设置中的默认策略</SelectItem>
                                <SelectItem value='auto'>本次自动</SelectItem>
                                <SelectItem value='scan'>本次扫描最优 endpoint</SelectItem>
                                <SelectItem value='custom'>本次使用自定义 endpoint 列表</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className='space-y-2 md:col-span-2'>
                        <Label htmlFor='custom-endpoints'>本次自定义 endpoint 列表</Label>
                        <Textarea
                            id='custom-endpoints'
                            value={customEndpointsText}
                            onChange={event => setCustomEndpointsText(event.target.value)}
                            disabled={endpointMode !== 'custom'}
                            placeholder={
                                endpointMode === 'custom'
                                    ? '每行一个 endpoint，或使用逗号分隔，例如 162.159.192.1:2408'
                                    : endpointMode === 'scan'
                                      ? '本次会先扫描最优 endpoint，无需手动填写'
                                      : '留空时按默认策略或自动模式处理'
                            }
                            className='min-h-28 font-mono'
                        />
                    </div>
                </CardContent>
            </Card>

            {accounts.length === 0 && (
                <Alert>
                    <AlertCircle className='h-4 w-4' />
                    <AlertDescription>当前还没有 Claude 账户。你可以先创建 WARP IP，稍后再到此页面绑定账户。</AlertDescription>
                </Alert>
            )}

            <div className='grid gap-4 md:grid-cols-4'>
                <Card>
                    <CardHeader>
                        <CardDescription>实例总数</CardDescription>
                        <CardTitle className='text-3xl'>{instances.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>运行中的代理</CardDescription>
                        <CardTitle className='text-3xl'>{runningCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>已拿到出口 IP</CardDescription>
                        <CardTitle className='text-3xl'>{availableIpCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>双栈实例</CardDescription>
                        <CardTitle className='text-3xl'>{dualStackCount}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {instances.length === 0 ? (
                <Card className='border-dashed'>
                    <CardContent className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
                        <div className='rounded-full bg-primary/10 p-4'>
                            <Shield className='h-8 w-8 text-primary' />
                        </div>
                        <div className='space-y-1'>
                            <h2 className='text-xl font-semibold'>还没有 WARP 实例</h2>
                            <p className='text-sm text-muted-foreground'>点击上方的“一键创建 IP”后，Clove 会自动注册、启动并探测公网出口 IP。</p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className='grid gap-4 xl:grid-cols-2'>
                    {instances.map(instance => {
                        const boundAccounts = accounts.filter(account => account.proxy_url === instance.proxy_url)
                        const availableAccounts = accounts.filter(account => !account.proxy_url)
                        const selectedAccountValue = selectedAccounts[instance.instance_id]
                        const selectedAccount = availableAccounts.some(
                            account => account.organization_uuid === selectedAccountValue,
                        )
                            ? selectedAccountValue
                            : availableAccounts[0]?.organization_uuid
                        const startKey = `start:${instance.instance_id}`
                        const stopKey = `stop:${instance.instance_id}`
                        const restartKey = `restart:${instance.instance_id}`
                        const deleteKey = `delete:${instance.instance_id}`
                        const bindKey = `bind:${instance.instance_id}`

                        return (
                            <Card key={instance.instance_id} className='gap-4'>
                                <CardHeader className='space-y-4'>
                                    <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                                        <div className='space-y-2'>
                                            <CardTitle className='flex items-center gap-2'>
                                                <Shield className='h-5 w-5 text-primary' />
                                                {instance.instance_id}
                                            </CardTitle>
                                            <CardDescription>独立 WARP 代理实例，可分配给一个或多个 Claude 账户。</CardDescription>
                                            <p className='text-sm text-muted-foreground'>endpoint 策略：{describeEndpointMode(instance)}</p>
                                        </div>
                                        {getStatusBadge(instance.status)}
                                    </div>

                                    <div className='grid gap-3 sm:grid-cols-2'>
                                        <div className='rounded-lg border bg-muted/30 p-3'>
                                            <div className='mb-1 flex items-center gap-2 text-sm text-muted-foreground'>
                                                <Globe className='h-4 w-4' />
                                                IPv4
                                            </div>
                                            <div className='font-mono text-sm'>{instance.public_ipv4 || '待探测'}</div>
                                        </div>
                                        <div className='rounded-lg border bg-muted/30 p-3'>
                                            <div className='mb-1 flex items-center gap-2 text-sm text-muted-foreground'>
                                                <Globe2 className='h-4 w-4' />
                                                IPv6
                                            </div>
                                            <div className='font-mono text-sm break-all'>{instance.public_ipv6 || '未分配 / 未探测'}</div>
                                        </div>
                                        <div className='rounded-lg border bg-muted/30 p-3'>
                                            <div className='mb-1 flex items-center gap-2 text-sm text-muted-foreground'>
                                                <Link2 className='h-4 w-4' />
                                                代理地址
                                            </div>
                                            <div className='font-mono text-sm break-all'>{instance.proxy_url}</div>
                                        </div>
                                        <div className='rounded-lg border bg-muted/30 p-3'>
                                            <div className='mb-1 text-sm text-muted-foreground'>端口</div>
                                            <div className='font-mono text-sm'>{instance.port}</div>
                                        </div>
                                        <div className='rounded-lg border bg-muted/30 p-3'>
                                            <div className='mb-1 text-sm text-muted-foreground'>最近启动</div>
                                            <div className='text-sm'>{formatDate(instance.last_started_at)}</div>
                                        </div>
                                    </div>

                                    {instance.error_message && (
                                        <Alert variant='destructive'>
                                            <AlertCircle className='h-4 w-4' />
                                            <AlertDescription>{instance.error_message}</AlertDescription>
                                        </Alert>
                                    )}
                                </CardHeader>

                                <CardContent className='space-y-4'>
                                    <div className='flex flex-wrap gap-2'>
                                        {instance.status === 'running' ? (
                                            <Button
                                                variant='outline'
                                                onClick={() =>
                                                    runAction(stopKey, async () => {
                                                        await warpApi.stop(instance.instance_id)
                                                        toast.success(`${instance.instance_id} 已停止`)
                                                    })
                                                }
                                                disabled={pendingActions.has(stopKey)}
                                            >
                                                {pendingActions.has(stopKey) ? (
                                                    <Loader2 className='h-4 w-4 animate-spin' />
                                                ) : (
                                                    <Square className='h-4 w-4' />
                                                )}
                                                停止
                                            </Button>
                                        ) : (
                                            <Button
                                                variant='outline'
                                                onClick={() =>
                                                    runAction(startKey, async () => {
                                                        await warpApi.start(instance.instance_id)
                                                        toast.success(`${instance.instance_id} 已启动`)
                                                    })
                                                }
                                                disabled={pendingActions.has(startKey)}
                                            >
                                                {pendingActions.has(startKey) ? (
                                                    <Loader2 className='h-4 w-4 animate-spin' />
                                                ) : (
                                                    <Play className='h-4 w-4' />
                                                )}
                                                启动
                                            </Button>
                                        )}

                                        <Button
                                            variant='outline'
                                            onClick={() =>
                                                runAction(restartKey, async () => {
                                                    await warpApi.restart(instance.instance_id)
                                                    toast.success(`${instance.instance_id} 已重启，并重新探测出口 IP`)
                                                })
                                            }
                                            disabled={instance.status === 'starting' || pendingActions.has(restartKey)}
                                        >
                                            {pendingActions.has(restartKey) ? (
                                                <Loader2 className='h-4 w-4 animate-spin' />
                                            ) : (
                                                <RefreshCw className='h-4 w-4' />
                                            )}
                                            重启
                                        </Button>

                                        <Button
                                            variant='destructive'
                                            onClick={() =>
                                                runAction(deleteKey, async () => {
                                                    await warpApi.delete(instance.instance_id)
                                                    toast.success(`${instance.instance_id} 已删除`)
                                                })
                                            }
                                            disabled={pendingActions.has(deleteKey)}
                                        >
                                            {pendingActions.has(deleteKey) ? (
                                                <Loader2 className='h-4 w-4 animate-spin' />
                                            ) : (
                                                <Trash2 className='h-4 w-4' />
                                            )}
                                            删除
                                        </Button>
                                    </div>

                                    <Separator />

                                        <div className='space-y-3'>
                                            <Label>绑定到账户</Label>
                                            <div className='flex flex-col gap-2 sm:flex-row'>
                                            <Select
                                                value={selectedAccount || undefined}
                                                onValueChange={value =>
                                                    setSelectedAccounts(prev => ({
                                                        ...prev,
                                                        [instance.instance_id]: value,
                                                    }))
                                                }
                                            >
                                                <SelectTrigger className='w-full' disabled={availableAccounts.length === 0}>
                                                    <SelectValue
                                                        placeholder={
                                                            availableAccounts.length === 0
                                                                ? '没有可绑定的 Claude 账户'
                                                                : '选择一个 Claude 账户'
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableAccounts.length === 0 ? (
                                                        <div className='px-2 py-1.5 text-sm text-muted-foreground'>
                                                            所有账户都已绑定，请先解绑后再重新分配
                                                        </div>
                                                    ) : (
                                                        availableAccounts.map(account => (
                                                            <SelectItem key={account.organization_uuid} value={account.organization_uuid}>
                                                                {shortId(account.organization_uuid)}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>

                                            <Button
                                                onClick={() => {
                                                    if (!selectedAccount) {
                                                        toast.error('请先选择要绑定的账户')
                                                        return
                                                    }

                                                    void runAction(bindKey, async () => {
                                                        await warpApi.bind(instance.instance_id, selectedAccount)
                                                        toast.success(`已将 ${instance.instance_id} 绑定到账户 ${shortId(selectedAccount)}`)
                                                    })
                                                }}
                                                disabled={
                                                    instance.status !== 'running' ||
                                                    pendingActions.has(bindKey) ||
                                                    availableAccounts.length === 0
                                                }
                                            >
                                                {pendingActions.has(bindKey) ? (
                                                    <Loader2 className='h-4 w-4 animate-spin' />
                                                ) : (
                                                    <Link2 className='h-4 w-4' />
                                                )}
                                                绑定
                                            </Button>
                                        </div>

                                        {availableAccounts.length === 0 && (
                                            <p className='text-sm text-muted-foreground'>
                                                已绑定到其他 WARP 实例的 Claude 账户不会出现在这里；如需改绑，请先到原实例解绑。
                                            </p>
                                        )}

                                        <div className='space-y-2'>
                                            <div className='text-sm text-muted-foreground'>当前绑定</div>
                                            {boundAccounts.length === 0 ? (
                                                <p className='text-sm text-muted-foreground'>暂无绑定账户</p>
                                            ) : (
                                                <div className='flex flex-wrap gap-2'>
                                                    {boundAccounts.map(account => {
                                                        const unbindKey = `unbind:${account.organization_uuid}`
                                                        return (
                                                            <div
                                                                key={account.organization_uuid}
                                                                className='flex items-center gap-2 rounded-md border px-3 py-2 text-sm'
                                                            >
                                                                <span className='font-mono'>{shortId(account.organization_uuid)}</span>
                                                                <Button
                                                                    variant='ghost'
                                                                    size='sm'
                                                                    className='h-7 px-2'
                                                                    onClick={() =>
                                                                        runAction(unbindKey, async () => {
                                                                            await warpApi.unbind(account.organization_uuid)
                                                                            toast.success(`已解绑账户 ${shortId(account.organization_uuid)}`)
                                                                        })
                                                                    }
                                                                    disabled={pendingActions.has(unbindKey)}
                                                                >
                                                                    {pendingActions.has(unbindKey) ? (
                                                                        <Loader2 className='h-4 w-4 animate-spin' />
                                                                    ) : (
                                                                        <Unplug className='h-4 w-4' />
                                                                    )}
                                                                    解绑
                                                                </Button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
