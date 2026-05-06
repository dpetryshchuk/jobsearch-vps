import { Mastra } from '@mastra/core'
import { jobsearchAgent } from './agents/jobsearch'

export const mastra = new Mastra({
    agents: { jobsearchAgent }, 
})