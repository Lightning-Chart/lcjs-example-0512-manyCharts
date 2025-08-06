/**
 *
 */
const lcjs = require('@lightningchart/lcjs')
const {
    lightningChart,
    AxisTickStrategies,
    emptyLine,
    AxisScrollStrategies,
    emptyFill,
    disableThemeEffects,
    isImageFill,
    SolidFill,
    ColorRGBA,
    DataSetXY,
    Themes,
} = lcjs

const exampleContainer = document.getElementById('chart') || document.body
if (exampleContainer === document.body) {
    exampleContainer.style.width = '100vw'
    exampleContainer.style.height = '100vh'
    exampleContainer.style.margin = '0px'
}
exampleContainer.style.display = 'flex'
exampleContainer.style.flexDirection = 'column'
exampleContainer.style.overflow = 'hidden'

const rowCount = 10
const columnCount = 10
const timeWindowS = 10
const streamRatePerChHz = 60
const dataSet = new DataSetXY({
    schema: {
        x: { auto: true },
        ...Object.fromEntries(Array.from({ length: rowCount * columnCount }, (_, i) => [`ch${i}`, { pattern: null }])),
    },
}).setMaxSampleCount(Math.ceil(timeWindowS * streamRatePerChHz))

// Application places canvas directly below example container, rather than library automatically placing it to bottom of document body. This is required for correct draw order in Interactive Examples DOM tree.
const canvas = document.createElement('canvas')
exampleContainer.append(canvas)
const lc = lightningChart({
    sharedContextOptions: {
        useIndividualCanvas: false,
        canvas,
    },
})
const charts = []
for (let row = 0; row < rowCount; row += 1) {
    const rowLayout = document.createElement('div')
    exampleContainer.append(rowLayout)
    rowLayout.style.flexGrow = '1'
    rowLayout.style.display = 'flex'
    rowLayout.style.flexDirection = 'row'
    for (let col = 0; col < columnCount; col += 1) {
        const container = document.createElement('div')
        rowLayout.append(container)
        container.style.flexGrow = '1'
        const chart = lc
            .ChartXY({
                container,
                interactable: false,
                animationsEnabled: false,
                theme: Themes[new URLSearchParams(window.location.search).get('theme') || 'darkGold'] || undefined,
                legend: { visible: false },
            })
            .setTitle('')
            .setPadding(0)
            .setTitleEffect(false)
            .setSeriesBackgroundEffect(false)
        if (isImageFill(chart.engine.getBackgroundFillStyle())) {
            chart.engine.setBackgroundFillStyle(new SolidFill({ color: ColorRGBA(0, 0, 0) }))
        }
        chart.forEachAxis((axis) =>
            axis.setTickStrategy(AxisTickStrategies.Empty).setStrokeStyle(emptyLine).setThickness(0).setTitleEffect(false),
        )
        chart.axisX
            .setScrollStrategy(AxisScrollStrategies.scrolling)
            .setInterval({ end: 0, start: -timeWindowS * streamRatePerChHz, stopAxisAfter: false })
        const series = chart
            .addPointLineAreaSeries({})
            .setStrokeStyle((stroke) => stroke.setThickness(1))
            .setEffect(false)
            .setDataSet(dataSet, { x: 'x', y: `ch${row * columnCount + col}` })
        const variant = Math.round(2 * Math.random())
        if (variant === 0) {
            // Line trend
            series.setAreaFillStyle(emptyFill).setPointFillStyle(emptyFill)
        } else if (variant === 1) {
            // Area trend
        } else {
            // Scatter trend
            series.setStrokeStyle(emptyLine).setAreaFillStyle(emptyFill).setPointSize(1)
        }
        charts.push({ chart, series })
    }
}

// Setup example data streaming
const cachedLoopedExampleData = charts.map(() => {
    let yList = []
    const variant = Math.round(5 * Math.random())
    if (variant === 0) {
        // Sine wave
        yList = new Array(120).fill(0).map((_, i, arr) => Math.sin((i * 2 * Math.PI) / arr.length))
        return yList
    }
    if (variant === 1) {
        // Saw wave
        yList = new Array(120).fill(0).map((_, i, arr) => i)
        return yList
    }
    if (variant === 2) {
        // Sine wave with alternating amplitude
        yList = new Array(180).fill(0).map((_, i, arr) => i * Math.sin((i * 2 * Math.PI) / 60))
        return yList
    }
    if (variant === 3) {
        // Varying 1 frame pulse
        yList = new Array(900).fill(0).map((_, i, arr) => (i % 90 === 0 ? Math.random() : 0))
        return yList
    }
    if (variant === 4) {
        // Progressive random trend
        let prev = 0
        for (let i = 0; i < 3000; i += 1) {
            const y = prev + (Math.random() * 2 - 1)
            prev = y
            yList.push(y)
        }
        yList.push(...yList.slice().reverse())
        return yList
    }
    // Random step
    let cur = Math.random()
    const variance = 0.93 + 0.065 * Math.random()
    for (let i = 0; i < 1200; i += 1) {
        if (Math.random() > variance) {
            cur = Math.random()
        }
        yList.push(cur)
    }
    return yList
})
let tPrev = performance.now()
let modulus = 0
let samplePosition = 0
const pushData = () => {
    const tNow = performance.now()
    let newPointCount = (Math.min(tNow - tPrev, 1000) / 1000) * streamRatePerChHz + modulus
    modulus = newPointCount % 1
    newPointCount = Math.floor(newPointCount)
    if (newPointCount > 0) {
        const newSamples = {}
        charts.forEach((chart, iChart) => {
            const chartData = cachedLoopedExampleData[iChart]
            const ysToPush = []
            for (let i = 0; i < newPointCount; i += 1) {
                ysToPush[i] = chartData[(samplePosition + i) % chartData.length]
            }
            newSamples[`ch${iChart}`] = ysToPush
        })
        samplePosition += newPointCount
        dataSet.appendSamples(newSamples)
    }
    tPrev = tNow
    requestAnimationFrame(pushData)
}
pushData()
